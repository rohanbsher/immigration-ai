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
  useCases,
  useCase,
  useCreateCase,
  useUpdateCase,
  useDeleteCase,
  useCaseStats,
} from './use-cases';

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

const mockCase = {
  id: 'case-1',
  attorney_id: 'att-1',
  client_id: 'client-1',
  visa_type: 'H-1B' as const,
  status: 'intake' as const,
  title: 'Test H-1B Case',
  description: 'A test case',
  priority_date: null,
  deadline: '2026-06-01',
  notes: null,
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
  attorney: {
    id: 'att-1',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@firm.com',
  },
  client: {
    id: 'client-1',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
  },
  documents_count: 3,
  forms_count: 1,
};

const mockCasesList = {
  cases: [mockCase],
  total: 1,
};

describe('useCases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches cases on mount', async () => {
    const fakeResponse = { ok: true };
    mockFetchWithTimeout.mockResolvedValue(fakeResponse);
    mockParseApiResponse.mockResolvedValue(mockCasesList);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCases(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockCasesList);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases?');
  });

  test('handles empty case list', async () => {
    const emptyCases = { cases: [], total: 0 };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(emptyCases);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCases(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(emptyCases);
    expect(result.current.data?.cases).toHaveLength(0);
  });

  test('passes filters to query params', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockCasesList);

    const { Wrapper } = createWrapper();
    renderHook(
      () => useCases({ status: 'intake', search: 'test' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=intake');
    expect(calledUrl).toContain('search=test');
  });

  test('passes array filters correctly', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockCasesList);

    const { Wrapper } = createWrapper();
    renderHook(
      () => useCases({ status: ['intake', 'in_progress'] }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=intake');
    expect(calledUrl).toContain('status=in_progress');
  });

  test('passes pagination options', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockCasesList);

    const { Wrapper } = createWrapper();
    renderHook(
      () => useCases({}, { page: 2, limit: 10, sortBy: 'created_at', sortOrder: 'desc' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('sortBy=created_at');
    expect(calledUrl).toContain('sortOrder=desc');
  });

  test('handles fetch errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Internal Server Error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCases(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches a single case by id', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockCase);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCase('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockCase);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/case-1');
  });

  test('does not fetch when id is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCase(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles error for single case fetch', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiResponse.mockRejectedValue(new Error('Case not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCase('nonexistent'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Case not found');
  });
});

describe('useCreateCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates a case and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockCase);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateCase(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        client_id: 'client-1',
        visa_type: 'H-1B',
        title: 'Test H-1B Case',
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'client-1',
        visa_type: 'H-1B',
        title: 'Test H-1B Case',
      }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cases'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['billing-usage'] });
  });

  test('mutation error state is set on failure', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Validation error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCase(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        client_id: 'client-1',
        visa_type: 'H-1B',
        title: '',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Validation error');
  });
});

describe('useUpdateCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('updates a case and invalidates related queries', async () => {
    const updatedCase = { ...mockCase, status: 'in_progress' as const };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(updatedCase);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateCase(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'case-1',
        data: { status: 'in_progress' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/case-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cases'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['case', 'case-1'] });
  });

  test('handles update error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 403 });
    mockParseApiResponse.mockRejectedValue(new Error('Forbidden'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateCase(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        id: 'case-1',
        data: { status: 'in_progress' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Forbidden');
  });
});

describe('useDeleteCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deletes a case and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteCase(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('case-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/case-1', {
      method: 'DELETE',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cases'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['billing-usage'] });
  });

  test('handles delete error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Case not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteCase(), {
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

describe('useCaseStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches case stats', async () => {
    const stats = {
      total: 15,
      pendingDeadlines: 3,
      byStatus: { intake: 5, in_progress: 7, completed: 3 },
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(stats);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCaseStats(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(stats);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/stats', {
      timeout: 'QUICK',
    });
  });

  test('handles stats fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCaseStats(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
