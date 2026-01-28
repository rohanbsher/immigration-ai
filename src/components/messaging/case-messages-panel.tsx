'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageThread } from './message-thread';
import { MessageInput } from './message-input';
import { useCaseMessages, useSendMessage } from '@/hooks/use-case-messages';
import { useUser } from '@/hooks/use-user';
import { MessageSquare, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CaseMessagesPanelProps {
  caseId: string;
  className?: string;
}

export function CaseMessagesPanel({ caseId, className }: CaseMessagesPanelProps) {
  const { profile, isLoading: isProfileLoading } = useUser();
  const { data, isLoading, error } = useCaseMessages(caseId);
  const { mutate: sendMessage, isPending: isSending } = useSendMessage(caseId);

  const handleSend = (content: string) => {
    sendMessage(content, {
      onError: (err) => {
        toast.error(err.message || 'Failed to send message');
      },
    });
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive/40 mx-auto mb-4" />
            <p className="text-muted-foreground">Failed to load messages</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Messages
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex flex-col h-[500px]">
        <MessageThread
          messages={data?.data || []}
          currentUserId={profile?.id || ''}
          isLoading={isLoading || isProfileLoading}
        />
        <MessageInput
          onSend={handleSend}
          isLoading={isSending}
          disabled={!profile}
          placeholder={
            profile?.role === 'client'
              ? 'Message your attorney...'
              : 'Message your client...'
          }
        />
      </CardContent>
    </Card>
  );
}
