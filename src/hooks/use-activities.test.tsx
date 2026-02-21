import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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

import { useActivities } from './use-activities';

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

const mockActivity = {
  id: 'activity-1',
  case_id: 'case-1',
  user_id: 'user-1',
  activity_type: 'document_uploaded' as const,
  description: 'Uploaded passport.pdf',
  metadata: { fileName: 'passport.pdf' },
  created_at: '2026-01-15T10:00:00Z',
  user: {
    id: 'user-1',
    first_name: 'Jane',
    last_name: 'Smith',
    avatar_url: null,
  },
};

describe('useActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches activities for a case', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([mockActivity]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useActivities('case-1'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([mockActivity]);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/case-1/activities');
  });

  test('handles empty activities list', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useActivities('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  test('does not fetch when caseId is empty string', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useActivities(''), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Internal Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useActivities('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Internal Server Error');
    expect(result.current.data).toBeUndefined();
  });

  test('fetches activities for different case ids', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([mockActivity]);

    const { Wrapper } = createWrapper();
    renderHook(() => useActivities('case-42'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/case-42/activities');
    });
  });

  test('returns multiple activities', async () => {
    const activities = [
      mockActivity,
      {
        ...mockActivity,
        id: 'activity-2',
        activity_type: 'status_changed' as const,
        description: 'Status changed to in_progress',
        metadata: { from: 'intake', to: 'in_progress' },
        created_at: '2026-01-16T10:00:00Z',
      },
    ];
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(activities);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useActivities('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
  });
});
