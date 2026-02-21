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
vi.mock('@/lib/api/parse-response', () => ({
  parseApiResponse: (...args: unknown[]) => mockParseApiResponse(...args),
}));

// Mock Supabase client
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnValue('subscribed'),
};
const mockRemoveChannel = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
  }),
}));

import { useCaseMessages, useSendMessage } from './use-case-messages';

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

const mockMessage = {
  id: 'msg-1',
  case_id: 'case-1',
  sender_id: 'user-1',
  content: 'Hello, this is a test message',
  read_at: null,
  created_at: '2026-01-15T10:00:00Z',
  deleted_at: null,
  sender: {
    id: 'user-1',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@firm.com',
    role: 'attorney',
    avatar_url: null,
  },
  attachments: [],
};

const mockMessagesResponse = {
  data: [mockMessage],
  total: 1,
  limit: 50,
  offset: 0,
};

describe('useCaseMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches messages for a case', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockMessagesResponse);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCaseMessages('case-1'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockMessagesResponse);
    expect(result.current.error).toBeNull();

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/cases/case-1/messages');
  });

  test('does not fetch when caseId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCaseMessages(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles empty messages list', async () => {
    const emptyResponse = { data: [], total: 0, limit: 50, offset: 0 };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(emptyResponse);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCaseMessages('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(emptyResponse);
    expect(result.current.data?.data).toHaveLength(0);
  });

  test('handles fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Internal Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCaseMessages('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });

  test('subscribes to realtime channel on mount', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockMessagesResponse);

    const { Wrapper } = createWrapper();
    renderHook(() => useCaseMessages('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });

  test('cleans up realtime subscription on unmount', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockMessagesResponse);

    const { Wrapper } = createWrapper();
    const { unmount } = renderHook(() => useCaseMessages('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});

describe('useSendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('sends a message and adds it to cache', async () => {
    const newMessage = {
      ...mockMessage,
      id: 'msg-2',
      content: 'New message',
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(newMessage);

    const { Wrapper, queryClient } = createWrapper();

    // Pre-populate the messages cache
    queryClient.setQueryData(['case-messages', 'case-1'], mockMessagesResponse);

    const { result } = renderHook(() => useSendMessage('case-1'), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('New message');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/case-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'New message' }),
    });

    // Verify the message was optimistically added to cache
    const cachedData = queryClient.getQueryData(['case-messages', 'case-1']) as typeof mockMessagesResponse;
    expect(cachedData.data).toHaveLength(2);
    expect(cachedData.data[1].content).toBe('New message');
    expect(cachedData.total).toBe(2);
  });

  test('throws error when caseId is undefined', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSendMessage(undefined), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('Hello');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Case ID is required');
  });

  test('invalidates queries on error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Send failed'));

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMessage('case-1'), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('Failing message');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['case-messages', 'case-1'] });
  });
});
