'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

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
  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }
  return response.json();
}

async function fetchUnreadCount(): Promise<number> {
  const response = await fetchWithTimeout('/api/notifications/count', {
    timeout: 'QUICK',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch unread count');
  }
  const data = await response.json();
  return data.count;
}

async function markAsRead(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/notifications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ read: true }),
  });
  if (!response.ok) {
    throw new Error('Failed to mark notification as read');
  }
}

async function markAllAsRead(): Promise<void> {
  const response = await fetchWithTimeout('/api/notifications/mark-all-read', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to mark all notifications as read');
  }
}

async function deleteNotification(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/notifications/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete notification');
  }
}

export function useNotifications(unreadOnly: boolean = false) {
  return useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => fetchNotifications(unreadOnly),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notificationsCount'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000,
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
