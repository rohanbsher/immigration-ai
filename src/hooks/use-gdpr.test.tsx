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
  useExportJobs,
  useRequestExport,
  useDeletionRequest,
  useRequestDeletion,
  useCancelDeletion,
} from './use-gdpr';

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

const mockExportJob = {
  id: 'export-1',
  user_id: 'user-1',
  status: 'completed' as const,
  created_at: '2026-01-15T00:00:00Z',
  completed_at: '2026-01-15T00:05:00Z',
};

const mockDeletionRequest = {
  id: 'del-1',
  user_id: 'user-1',
  status: 'pending' as const,
  reason: 'Leaving the platform',
  scheduled_for: '2026-02-15T00:00:00Z',
  created_at: '2026-01-15T00:00:00Z',
};

describe('useExportJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches export jobs on mount', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([mockExportJob]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useExportJobs(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([mockExportJob]);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/gdpr/export');
  });

  test('handles empty export jobs list', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useExportJobs(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  test('handles fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useExportJobs(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useRequestExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('requests data export and invalidates queries', async () => {
    const exportResult = { jobId: 'export-2', exportData: { users: [] } };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(exportResult);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRequestExport(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/gdpr/export', {
      method: 'POST',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gdpr', 'exports'] });
  });

  test('handles export request error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 429 });
    mockParseApiResponse.mockRejectedValue(new Error('Too many requests'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRequestExport(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Too many requests');
  });
});

describe('useDeletionRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches deletion request on mount', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockDeletionRequest);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeletionRequest(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockDeletionRequest);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/gdpr/delete');
  });

  test('handles null deletion request (no pending request)', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(null);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeletionRequest(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });

  test('handles fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeletionRequest(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useRequestDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('requests account deletion and invalidates queries', async () => {
    const deletionResult = { id: 'del-2', scheduledFor: '2026-03-15T00:00:00Z' };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(deletionResult);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRequestDeletion(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('Leaving the platform');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/gdpr/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Leaving the platform' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gdpr', 'deletion'] });
  });

  test('requests deletion without reason', async () => {
    const deletionResult = { id: 'del-3', scheduledFor: '2026-03-15T00:00:00Z' };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(deletionResult);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRequestDeletion(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/gdpr/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: undefined }),
    });
  });

  test('handles deletion request error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Already pending'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRequestDeletion(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('reason');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Already pending');
  });
});

describe('useCancelDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('cancels deletion and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelDeletion(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('Changed my mind');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/gdpr/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Changed my mind' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gdpr', 'deletion'] });
  });

  test('handles cancel error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('No pending request'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCancelDeletion(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('reason');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('No pending request');
  });
});
