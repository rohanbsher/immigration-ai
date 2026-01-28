'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from './message-bubble';
import { Loader2, MessageSquare } from 'lucide-react';
import type { CaseMessage } from '@/hooks/use-case-messages';

interface MessageThreadProps {
  messages: CaseMessage[];
  currentUserId: string;
  isLoading?: boolean;
}

export function MessageThread({ messages, currentUserId, isLoading }: MessageThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">No messages yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Start the conversation by sending a message below.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwnMessage={message.sender_id === currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
