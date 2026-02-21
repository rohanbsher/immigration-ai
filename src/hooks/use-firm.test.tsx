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
  useFirms,
  useFirm,
  useCreateFirm,
  useUpdateFirm,
  useDeleteFirm,
  useCurrentFirm,
} from './use-firm';

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

const mockFirmData = {
  id: 'firm-1',
  name: 'Smith & Associates',
  slug: 'smith-associates',
  address: '123 Legal Ave',
  phone: '555-0100',
  email: 'info@smithlaw.com',
  website: 'https://smithlaw.com',
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
};

const mockFirmWithRole = {
  ...mockFirmData,
  userRole: 'owner' as const,
};

describe('useFirms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches firms list on mount', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([mockFirmData]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirms(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([mockFirmData]);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms');
  });

  test('handles empty firms list', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirms(), {
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
    const { result } = renderHook(() => useFirms(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useFirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches a single firm by id', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockFirmWithRole);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirm('firm-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockFirmWithRole);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms/firm-1');
  });

  test('does not fetch when firmId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirm(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles error for single firm fetch', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiResponse.mockRejectedValue(new Error('Firm not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFirm('nonexistent'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Firm not found');
  });
});

describe('useCreateFirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates a firm and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockFirmData);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateFirm(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Smith & Associates',
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smith & Associates' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['firms'] });
  });

  test('handles creation error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Firm name required'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateFirm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ name: '' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Firm name required');
  });
});

describe('useUpdateFirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('updates a firm and invalidates queries', async () => {
    const updatedFirm = { ...mockFirmData, name: 'Smith & Partners' };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(updatedFirm);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateFirm(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        firmId: 'firm-1',
        input: { name: 'Smith & Partners' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms/firm-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smith & Partners' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['firms'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['firm', 'firm-1'] });
  });

  test('handles update error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 403 });
    mockParseApiResponse.mockRejectedValue(new Error('Forbidden'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateFirm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        firmId: 'firm-1',
        input: { name: 'New Name' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Forbidden');
  });
});

describe('useDeleteFirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deletes a firm and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteFirm(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('firm-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/firms/firm-1', {
      method: 'DELETE',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['firms'] });
  });

  test('handles delete error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Firm not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteFirm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('nonexistent');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Firm not found');
  });
});

describe('useCurrentFirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns the first firm when firms are loaded', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([mockFirmData]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCurrentFirm(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.firm).toEqual(mockFirmData);
  });

  test('returns null firm when no firms exist', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCurrentFirm(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.firm).toBeNull();
  });

  test('returns loading state initially', () => {
    mockFetchWithTimeout.mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCurrentFirm(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.firm).toBeNull();
  });
});
