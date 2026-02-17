'use client';

import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/use-chat';
import { useConsent } from '@/hooks/use-consent';
import { MessageSquare, Sparkles } from 'lucide-react';

interface ChatButtonProps {
  className?: string;
}

/**
 * Floating chat button component.
 */
export function ChatButton({ className }: ChatButtonProps) {
  const { isOpen, toggleChat, messages } = useChat();
  const { analyticsConsented } = useConsent();

  // Shift button up when the cookie consent banner is visible
  const isCookieBannerVisible = analyticsConsented === null;

  // Count unread/active messages (assistant messages that are streaming)
  const hasActiveMessage = messages.some(
    (m: { role: string; isStreaming?: boolean }) => m.role === 'assistant' && m.isStreaming
  );

  return (
    <button
      onClick={toggleChat}
      className={cn(
        'fixed right-6 z-50',
        'w-14 h-14 rounded-full',
        'bg-ai-accent hover:bg-ai-accent/90 text-ai-accent-foreground',
        'shadow-lg hover:shadow-xl',
        'transition-all duration-200',
        'flex items-center justify-center',
        'group',
        isCookieBannerVisible ? 'bottom-20' : 'bottom-6',
        isOpen && 'scale-95 opacity-0 pointer-events-none',
        className
      )}
      aria-label="Open AI chat assistant"
    >
      {/* Icon */}
      <div className="relative">
        <MessageSquare
          size={24}
          className="transition-transform group-hover:scale-110"
        />
        <Sparkles
          size={12}
          className="absolute -top-1 -right-1 text-warning"
        />
      </div>

      {/* Active indicator */}
      {hasActiveMessage && (
        <span className="absolute top-0 right-0 w-4 h-4 bg-success rounded-full border-2 border-background animate-pulse" />
      )}

      {/* Tooltip */}
      <span
        className={cn(
          'absolute right-full mr-3 px-3 py-1.5 rounded-lg',
          'bg-foreground text-background text-sm whitespace-nowrap',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'pointer-events-none'
        )}
      >
        AI Assistant
      </span>
    </button>
  );
}

/**
 * Compact chat button for case pages.
 */
export function CaseChatButton({
  caseId,
  className,
}: {
  caseId: string;
  className?: string;
}) {
  const { openChat } = useChat();

  return (
    <button
      onClick={() => openChat(caseId)}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'bg-ai-accent-muted hover:bg-ai-accent-muted/80 text-ai-accent',
        'transition-colors text-sm font-medium',
        className
      )}
    >
      <Sparkles size={14} />
      Ask AI
    </button>
  );
}
