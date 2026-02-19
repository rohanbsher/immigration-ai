'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse } from '@/lib/api/parse-response';

/** Polling interval for messages when realtime is supplementing (ms). */
const MESSAGE_POLL_INTERVAL_MS = 30_000;

interface MessageSender {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface CaseMessage {
  id: string;
  case_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  deleted_at: string | null;
  sender?: MessageSender;
  attachments?: MessageAttachment[];
}

interface MessagesResponse {
  data: CaseMessage[];
  total: number;
  limit: number;
  offset: number;
}

async function fetchMessages(
  caseId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<MessagesResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());

  const response = await fetchWithTimeout(
    `/api/cases/${caseId}/messages?${params.toString()}`
  );
  return parseApiResponse<MessagesResponse>(response);
}

async function sendMessage(caseId: string, content: string): Promise<CaseMessage> {
  const response = await fetchWithTimeout(`/api/cases/${caseId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return parseApiResponse<CaseMessage>(response);
}

/**
 * Hook for managing case messages with real-time updates
 */
export function useCaseMessages(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const query = useQuery({
    queryKey: ['case-messages', caseId],
    queryFn: () => fetchMessages(caseId!),
    enabled: !!caseId,
    staleTime: MESSAGE_POLL_INTERVAL_MS,
    refetchInterval: MESSAGE_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  // Set up Supabase Realtime subscription
  useEffect(() => {
    if (!caseId) return;

    const channel = supabase
      .channel(`case-messages:${caseId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'case_messages',
          filter: `case_id=eq.${caseId}`,
        },
        () => {
          // Invalidate to refetch with full sender info.
          // We don't optimistically add the raw payload because it lacks
          // sender/attachment data and would be immediately overwritten
          // by the refetch, causing a visual flicker.
          queryClient.invalidateQueries({ queryKey: ['case-messages', caseId] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [caseId, queryClient, supabase]);

  return query;
}

/**
 * Hook for sending messages
 */
export function useSendMessage(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => {
      if (!caseId) throw new Error('Case ID is required');
      return sendMessage(caseId, content);
    },
    onSuccess: (newMessage) => {
      // Optimistically add the message to the cache
      queryClient.setQueryData<MessagesResponse>(
        ['case-messages', caseId],
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: [...oldData.data, newMessage],
            total: oldData.total + 1,
          };
        }
      );
    },
    onError: () => {
      // Refetch on error to ensure consistent state
      queryClient.invalidateQueries({ queryKey: ['case-messages', caseId] });
    },
  });
}

