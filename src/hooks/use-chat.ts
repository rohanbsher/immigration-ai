'use client';

import { useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useChatStore, type Conversation } from '@/store/chat-store';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse, parseApiVoidResponse } from '@/lib/api/parse-response';
import { safeParseErrorJson } from '@/lib/api/safe-json';

/**
 * Chat hook for sending messages and managing chat state.
 */
export function useChat() {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const {
    isOpen,
    isLoading,
    error,
    currentConversationId,
    caseId,
    messages,
    conversations,
    openChat,
    closeChat,
    toggleChat,
    setCaseContext,
    addMessage,
    updateMessage,
    setMessageStreaming,
    clearMessages,
    setConversationId,
    setConversations,
    startNewConversation,
    setLoading,
    setError,
  } = useChatStore();

  // Fetch conversations
  const conversationsQuery = useQuery({
    queryKey: ['conversations', caseId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (caseId) params.set('caseId', caseId);

      const response = await fetchWithTimeout(`/api/chat?${params.toString()}`, {
        timeout: 'STANDARD',
      });
      const data = await parseApiResponse<{ conversations: Conversation[] }>(response);
      setConversations(data.conversations);
      return data.conversations;
    },
    enabled: isOpen,
    staleTime: 30000, // 30 seconds
  });

  // Fetch conversation messages
  const loadConversation = useCallback(
    async (conversationId: string) => {
      try {
        setLoading(true);

        const response = await fetchWithTimeout(`/api/chat/${conversationId}`, {
          timeout: 'STANDARD',
        });
        const data = await parseApiResponse<{ messages: { role: 'user' | 'assistant'; content: string }[] }>(response);

        // Clear current messages and load from server
        clearMessages();
        setConversationId(conversationId);

        // Add messages to store
        (data.messages || []).forEach((msg: { role: 'user' | 'assistant'; content: string }) => {
          addMessage({
            role: msg.role,
            content: msg.content,
          });
        });

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      }
    },
    [addMessage, clearMessages, setConversationId, setError, setLoading]
  );

  // Track the latest assistant message ID for error cleanup
  const assistantMsgIdRef = useRef<string | null>(null);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Add user message
      addMessage({
        role: 'user',
        content: message,
      });

      // Add placeholder for assistant response
      const assistantMsgId = addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      assistantMsgIdRef.current = assistantMsgId;

      setLoading(true);
      setError(null);

      // Send request — uses AI timeout for streaming, but preserves user's abort signal
      const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), 120_000);
      let response: Response;
      try {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: currentConversationId,
            caseId,
            message,
          }),
          signal: abortControllerRef.current.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const error = await safeParseErrorJson(response);
        throw new Error(error.message || 'Failed to send message');
      }

      // Process streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }

      readerRef.current = reader;
      const decoder = new TextDecoder();
      let assistantContent = '';
      let sseBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          // Keep the last (possibly incomplete) line in the buffer
          sseBuffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            let data;
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              // Skip invalid JSON lines (e.g. keepalive comments)
              continue;
            }

            if (data.type === 'conversation') {
              setConversationId(data.id);
            } else if (data.type === 'content') {
              assistantContent += data.text;
              updateMessage(assistantMsgId, assistantContent);
            } else if (data.type === 'error') {
              throw new Error(data.message);
            } else if (data.type === 'done') {
              setMessageStreaming(assistantMsgId, false);
            }
          }
        }
      } finally {
        readerRef.current = null;
        reader.cancel().catch(() => {});
      }

      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      return assistantContent;
    },
    onError: (error) => {
      // Clear the streaming state and show error in the assistant message
      if (assistantMsgIdRef.current) {
        setMessageStreaming(assistantMsgIdRef.current, false);
        if (error.name !== 'AbortError') {
          updateMessage(assistantMsgIdRef.current, '[Message failed to send]');
        }
        assistantMsgIdRef.current = null;
      }
      if (error.name === 'AbortError') {
        readerRef.current?.cancel().catch(() => {});
        readerRef.current = null;
        return;
      }
      setError(error instanceof Error ? error.message : 'Failed to send message');
    },
    onSettled: () => {
      setLoading(false);
      abortControllerRef.current = null;
    },
  });

  // Delete conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetchWithTimeout(`/api/chat/${conversationId}`, {
        method: 'DELETE',
        timeout: 'STANDARD',
      });
      await parseApiVoidResponse(response);
    },
    onSuccess: (_, conversationId) => {
      // If deleting current conversation, start fresh
      if (currentConversationId === conversationId) {
        startNewConversation();
      }

      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Cancel ongoing request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      readerRef.current?.cancel().catch(() => {});
      readerRef.current = null;
      setLoading(false);
    }
  }, [setLoading]);

  return {
    // State
    isOpen,
    isLoading,
    error,
    currentConversationId,
    caseId,
    messages,
    conversations,
    isLoadingConversations: conversationsQuery.isLoading,

    // UI actions
    openChat,
    closeChat,
    toggleChat,
    setCaseContext,

    // Message actions
    sendMessage: sendMessageMutation.mutate,
    cancelRequest,
    clearMessages,

    // Conversation actions
    loadConversation,
    startNewConversation,
    deleteConversation: deleteConversationMutation.mutate,

    // Loading states
    isSending: sendMessageMutation.isPending,
    isDeleting: deleteConversationMutation.isPending,
  };
}

/**
 * Hook for opening chat with case context.
 */
export function useChatWithCase(caseId: string) {
  const { openChat, setCaseContext } = useChatStore();

  const open = useCallback(() => {
    setCaseContext(caseId);
    openChat(caseId);
  }, [caseId, openChat, setCaseContext]);

  return { openChat: open };
}
