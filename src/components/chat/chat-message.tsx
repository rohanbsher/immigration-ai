'use client';

import { cn } from '@/lib/utils';
import { User, Sparkles } from 'lucide-react';
import { memo } from 'react';
import { logger } from '@/lib/logger';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp?: string;
}

/**
 * Chat message bubble component.
 */
export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  isStreaming,
  timestamp,
}: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-foreground text-background'
            : 'bg-ai-accent-muted text-ai-accent'
        )}
      >
        {isUser ? <User size={16} /> : <Sparkles size={16} />}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'flex-1 min-w-0 max-w-[85%]',
          isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'
        )}
      >
        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isUser
              ? 'bg-foreground text-background rounded-tr-sm'
              : 'bg-card border border-border rounded-tl-sm',
            isStreaming && !isUser && 'animate-pulse'
          )}
        >
          {/* Content with markdown-like rendering */}
          <div className="text-sm whitespace-pre-wrap break-words">
            {content || (isStreaming ? '...' : '')}
            {isStreaming && !isUser && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-ai-accent animate-blink" />
            )}
          </div>
        </div>

        {/* Timestamp */}
        {timestamp && !isStreaming && (
          <span className="text-xs text-muted-foreground mt-1 px-1">
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </div>
  );
});

/**
 * Format timestamp for display.
 */
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    logger.warn('Failed to format timestamp', { error });
    return '';
  }
}

/**
 * Typing indicator component.
 */
export function TypingIndicator() {
  return (
    <div className="flex gap-3 p-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ai-accent-muted text-ai-accent flex items-center justify-center">
        <Sparkles size={16} />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-ai-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-ai-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-ai-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
