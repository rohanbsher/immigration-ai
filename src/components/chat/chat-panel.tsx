'use client';

import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/use-chat';
import { ChatMessage as ChatMessageComponent, TypingIndicator } from './chat-message';
import { AIBadge } from '@/components/ai';
import type { ChatMessage } from '@/store/chat-store';
import {
  X,
  Send,
  MessageSquare,
  Plus,
  Trash2,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';

interface ChatPanelProps {
  className?: string;
}

/**
 * Chat panel slide-out component.
 */
export function ChatPanel({ className }: ChatPanelProps) {
  const {
    isOpen,
    isLoading,
    isSending,
    error,
    currentConversationId,
    caseId,
    messages,
    conversations,
    isLoadingConversations,
    closeChat,
    sendMessage,
    cancelRequest,
    clearMessages,
    loadConversation,
    startNewConversation,
    deleteConversation,
  } = useChat();

  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up submit timeout on unmount
  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !showHistory) {
      const timeoutId = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, showHistory]);

  // Handle form submit
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed || isSending || isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      sendMessage(trimmed);
      setInputValue('');
      // Reset after a brief delay to allow mutation to start
      const id = setTimeout(() => { isSubmittingRef.current = false; }, 500);
      submitTimeoutRef.current = id;
    },
    [inputValue, isSending, sendMessage]
  );

  // Handle conversation selection
  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      loadConversation(conversationId);
      setShowHistory(false);
    },
    [loadConversation]
  );

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    startNewConversation();
    setShowHistory(false);
  }, [startNewConversation]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={closeChat}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full sm:w-[400px] bg-slate-50 shadow-2xl z-50',
          'flex flex-col',
          'animate-in slide-in-from-right duration-300',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          {showHistory ? (
            <>
              <button
                onClick={() => setShowHistory(false)}
                className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <span className="font-medium text-slate-900">Conversations</span>
              <button
                onClick={handleNewConversation}
                className="text-purple-600 hover:text-purple-700"
              >
                <Plus size={20} />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <AIBadge size="sm" />
                <span className="font-medium text-slate-900">AI Assistant</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowHistory(true)}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  title="Conversation history"
                >
                  <MessageSquare size={18} />
                </button>
                <button
                  onClick={closeChat}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Context indicator */}
        {caseId && !showHistory && (
          <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 text-xs text-purple-700">
            Discussing: Case context active
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {showHistory ? (
            <ConversationHistory
              conversations={conversations}
              currentId={currentConversationId}
              isLoading={isLoadingConversations}
              onSelect={handleSelectConversation}
              onDelete={deleteConversation}
              onNew={handleNewConversation}
            />
          ) : (
            <div className="h-full flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                  <EmptyChat caseId={caseId} />
                ) : (
                  <div className="py-2">
                    {messages.map((message: ChatMessage) => (
                      <ChatMessageComponent
                        key={message.id}
                        role={message.role}
                        content={message.content}
                        isStreaming={message.isStreaming}
                        timestamp={message.createdAt}
                      />
                    ))}
                    {isLoading && !messages.some((m: ChatMessage) => m.isStreaming) && (
                      <TypingIndicator />
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Input */}
              <form
                onSubmit={handleSubmit}
                className="p-4 border-t border-slate-200 bg-white"
              >
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask about this case..."
                    disabled={isSending}
                    className="flex-1"
                  />
                  {isSending ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={cancelRequest}
                    >
                      <X size={18} />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!inputValue.trim()}
                    >
                      <Send size={18} />
                    </Button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Empty chat state.
 */
function EmptyChat({ caseId }: { caseId: string | null }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
        <MessageSquare size={28} className="text-purple-500" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-2">
        {caseId ? 'Case Assistant' : 'AI Assistant'}
      </h3>
      <p className="text-sm text-slate-500 mb-6 max-w-[250px]">
        {caseId
          ? 'Ask questions about this case, documents, deadlines, or next steps.'
          : 'Ask questions about your cases, documents, or immigration processes.'}
      </p>
      <div className="space-y-2 text-sm text-slate-600">
        <p className="font-medium">Try asking:</p>
        <ul className="space-y-1 text-left">
          <li>&quot;What documents are missing?&quot;</li>
          <li>&quot;What are the next steps?&quot;</li>
          <li>&quot;What&apos;s the deadline?&quot;</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Conversation history list.
 */
function ConversationHistory({
  conversations,
  currentId,
  isLoading,
  onSelect,
  onDelete,
  onNew,
}: {
  conversations: { id: string; title: string; updatedAt: string }[];
  currentId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <MessageSquare size={32} className="text-slate-300 mb-4" />
        <p className="text-sm text-slate-500 mb-4">No conversations yet</p>
        <Button onClick={onNew} size="sm">
          <Plus size={16} className="mr-1" />
          Start a conversation
        </Button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 hover:bg-slate-100 cursor-pointer group',
            currentId === conv.id && 'bg-purple-50'
          )}
          onClick={() => onSelect(conv.id)}
        >
          <MessageSquare size={18} className="text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {conv.title}
            </p>
            <p className="text-xs text-slate-500">
              {formatRelativeTime(conv.updatedAt)}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conv.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Format relative time.
 */
function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  } catch {
    return '';
  }
}
