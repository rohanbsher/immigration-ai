'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { CaseMessage } from '@/hooks/use-case-messages';

interface MessageBubbleProps {
  message: CaseMessage;
  isOwnMessage: boolean;
}

export function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const sender = message.sender;
  const initials = sender
    ? `${sender.first_name?.[0] || ''}${sender.last_name?.[0] || ''}`.toUpperCase()
    : 'U';
  const senderName = sender
    ? `${sender.first_name} ${sender.last_name}`
    : 'Unknown User';
  const roleLabel = sender?.role === 'attorney' ? 'Attorney' : 'Client';

  return (
    <div
      className={cn(
        'flex gap-3 max-w-[80%]',
        isOwnMessage ? 'ml-auto flex-row-reverse' : ''
      )}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={sender?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className={cn('flex flex-col', isOwnMessage ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{senderName}</span>
          <span className="text-xs text-muted-foreground">({roleLabel})</span>
        </div>

        <div
          className={cn(
            'rounded-lg px-4 py-2 max-w-full',
            isOwnMessage
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          )}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.created_at), 'MMM d, h:mm a')}
          </span>
          {isOwnMessage && message.read_at && (
            <span className="text-xs text-muted-foreground">Read</span>
          )}
        </div>
      </div>
    </div>
  );
}
