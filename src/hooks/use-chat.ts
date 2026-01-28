'use client';

import { useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useChatStore } from '@/store/chat-store';

/**
 * Chat hook for sending messages and managing chat state.
 */
export function useChat() {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

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

      const response = await fetch(`/api/chat?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
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

        const response = await fetch(`/api/chat/${conversationId}`);
        if (!response.ok) {
          throw new Error('Failed to load conversation');
        }

        const data = await response.json();

        // Clear current messages and load from server
        clearMessages();
        setConversationId(conversationId);

        // Add messages to store
        data.messages.forEach((msg: { role: 'user' | 'assistant'; content: string }) => {
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

      setLoading(true);
      setError(null);

      // Send request
      const response = await fetch('/api/chat', {
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send message');
      }

      // Process streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }

      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

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
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      return assistantContent;
    },
    onError: (error) => {
      if (error.name === 'AbortError') return;
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
      const response = await fetch(`/api/chat/${conversationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }
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
