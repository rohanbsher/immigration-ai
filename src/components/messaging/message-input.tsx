'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  isLoading = false,
  disabled = false,
  placeholder = 'Type your message...',
}: MessageInputProps) {
  const [content, setContent] = useState('');

  const handleSend = useCallback(() => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isLoading || disabled) return;

    onSend(trimmedContent);
    setContent('');
  }, [content, isLoading, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Send on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex gap-2 p-4 border-t bg-background">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className="min-h-[60px] max-h-[200px] resize-none"
        rows={2}
      />
      <Button
        onClick={handleSend}
        disabled={!content.trim() || isLoading || disabled}
        size="icon"
        className="h-[60px] w-[60px] flex-shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
