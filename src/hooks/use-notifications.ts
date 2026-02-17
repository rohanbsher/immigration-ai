'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse, parseApiVoidResponse } from '@/lib/api/parse-response';

type NotificationType = 'info' | 'warning' | 'success' | 'error';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

async function fetchNotifications(unreadOnly: boolean = false): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (unreadOnly) params.set('unread', 'true');

  const response = await fetchWithTimeout(`/api/notifications?${params.toString()}`);
  const data = await parseApiResponse<Notification[]>(response);
  return Array.isArray(data) ? data : [];
}

async function fetchUnreadCount(): Promise<number> {
  const response = await fetchWithTimeout('/api/notifications/count', {
    timeout: 'QUICK',
  });
  const data = await parseApiResponse<{ count: number }>(response);
  return data.count;
}

async function markAsRead(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/notifications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ read: true }),
  });
  await parseApiVoidResponse(response);
}

async function markAllAsRead(): Promise<void> {
  const response = await fetchWithTimeout('/api/notifications/mark-all-read', {
    method: 'POST',
  });
  await parseApiVoidResponse(response);
}

async function deleteNotification(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/notifications/${id}`, {
    method: 'DELETE',
  });
  await parseApiVoidResponse(response);
}

export function useNotifications(unreadOnly: boolean = false) {
  return useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => fetchNotifications(unreadOnly),
    staleTime: 30 * 1000, // 30 seconds — time-sensitive but not instant
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notificationsCount'],
    queryFn: fetchUnreadCount,
    staleTime: 15 * 1000, // 15 seconds — badge should be fairly current
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationsCount'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationsCount'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationsCount'] });
    },
  });
}
