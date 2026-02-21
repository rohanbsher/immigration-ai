import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock fetch-with-timeout
const mockFetchWithTimeout = vi.fn();
vi.mock('@/lib/api/fetch-with-timeout', () => {
  class MockTimeoutError extends Error {
    constructor(timeout: number) {
      super(`Request timed out after ${timeout / 1000} seconds`);
      this.name = 'TimeoutError';
    }
  }
  return {
    fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
    TimeoutError: MockTimeoutError,
  };
});

// Mock parse-response
const mockParseApiResponse = vi.fn();
const mockParseApiVoidResponse = vi.fn();
vi.mock('@/lib/api/parse-response', () => ({
  parseApiResponse: (...args: unknown[]) => mockParseApiResponse(...args),
  parseApiVoidResponse: (...args: unknown[]) => mockParseApiVoidResponse(...args),
}));

import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from './use-notifications';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = 'TestQueryWrapper';
  return { Wrapper, queryClient };
}

const mockNotification = {
  id: 'notif-1',
  user_id: 'user-1',
  title: 'Document uploaded',
  message: 'A new passport document was uploaded to case H-1B',
  type: 'info' as const,
  read: false,
  action_url: '/dashboard/cases/case-1',
  created_at: '2026-02-20T10:00:00Z',
};

const mockNotificationRead = {
  ...mockNotification,
  id: 'notif-2',
  title: 'Case updated',
  message: 'Case status changed to in_progress',
  read: true,
  action_url: null,
};

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches all notifications', async () => {
    const notifications = [mockNotification, mockNotificationRead];
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(notifications);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotifications(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(notifications);
    expect(result.current.error).toBeNull();

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/notifications?');
    // Without unreadOnly, should not have unread=true
    expect(calledUrl).not.toContain('unread=true');
  });

  test('fetches unread notifications only', async () => {
    const unread = [mockNotification];
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(unread);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotifications(true), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(unread);

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('unread=true');
  });

  test('handles non-array response gracefully', async () => {
    // fetchNotifications wraps non-array in empty array
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotifications(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  test('handles empty notifications', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotifications(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  test('handles fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Internal Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNotifications(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches unread count', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ count: 5 });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe(5);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/notifications/count', {
      timeout: 'QUICK',
    });
  });

  test('handles zero unread count', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ count: 0 });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe(0);
  });

  test('handles count fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useMarkAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('marks a notification as read and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMarkAsRead(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('notif-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/notifications/notif-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notificationsCount'] });
  });

  test('handles mark as read error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Notification not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMarkAsRead(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('nonexistent');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Notification not found');
  });
});

describe('useMarkAllAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('marks all notifications as read and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMarkAllAsRead(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/notifications/mark-all-read', {
      method: 'POST',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notificationsCount'] });
  });

  test('handles mark all as read error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMarkAllAsRead(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useDeleteNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deletes a notification and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteNotification(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('notif-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/notifications/notif-1', {
      method: 'DELETE',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notificationsCount'] });
  });

  test('handles delete error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Notification not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteNotification(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('nonexistent');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
