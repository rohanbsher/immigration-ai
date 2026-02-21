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

import {
  useQuota,
  useQuotaCheck,
  useInvalidateQuotas,
} from './use-quota';

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

const mockQuotaData = {
  allowed: true,
  current: 5,
  limit: 100,
  remaining: 95,
  isUnlimited: false,
};

describe('useQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches quota for a metric on mount', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockQuotaData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useQuota('cases'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockQuotaData);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/quota?metric=cases');
  });

  test('fetches quota for different metrics', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ ...mockQuotaData, current: 10 });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useQuota('ai_requests'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/quota?metric=ai_requests');
  });

  test('handles unlimited quota', async () => {
    const unlimitedQuota = {
      allowed: true,
      current: 500,
      limit: -1,
      remaining: Infinity,
      isUnlimited: true,
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(unlimitedQuota);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useQuota('cases'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.isUnlimited).toBe(true);
  });

  test('handles fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useQuota('cases'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useQuotaCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('performs quota check mutation and calls API with correct URL', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockQuotaData);

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQuotaCheck(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      const data = await result.current.mutateAsync('cases');
      expect(data).toEqual(mockQuotaData);
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/billing/quota?metric=cases');
  });

  test('handles quota check with not-allowed result', async () => {
    const notAllowed = {
      allowed: false,
      current: 100,
      limit: 100,
      remaining: 0,
      isUnlimited: false,
      message: 'Quota exceeded for cases',
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(notAllowed);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useQuotaCheck(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      const data = await result.current.mutateAsync('cases');
      expect(data.allowed).toBe(false);
      expect(data.message).toBe('Quota exceeded for cases');
    });
  });

  test('handles quota check error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Quota check failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useQuotaCheck(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('cases');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Quota check failed');
  });
});

describe('useInvalidateQuotas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns a callback that invalidates all quota queries', () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateQuotas(), {
      wrapper: Wrapper,
    });

    // Should return a function
    expect(typeof result.current).toBe('function');

    // Call it
    result.current();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['quota'] });
  });

  test('callback is stable across renders', () => {
    const { Wrapper } = createWrapper();
    const { result, rerender } = renderHook(() => useInvalidateQuotas(), {
      wrapper: Wrapper,
    });

    const firstCallback = result.current;
    rerender();
    const secondCallback = result.current;

    expect(firstCallback).toBe(secondCallback);
  });
});
