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
  useClients,
  useClient,
  useClientCases,
  useUpdateClient,
  useCreateClient,
  useSearchClients,
  useClientsPaginated,
} from './use-clients';

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

const mockClientData = {
  id: 'client-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '555-1234',
  date_of_birth: '1990-01-01',
  nationality: 'US',
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
  cases: [],
};

const mockClientsResponse = {
  data: [mockClientData],
  pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
};

describe('useClients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches all clients on mount', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockClientsResponse);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClients(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // useClients extracts .data from the response
    expect(result.current.data).toEqual([mockClientData]);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/clients?limit=100');
  });

  test('handles empty clients list', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClients(), {
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
    const { result } = renderHook(() => useClients(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches a single client by id', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockClientData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClient('client-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockClientData);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/clients/client-1');
  });

  test('does not fetch when id is empty string', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClient(''), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles error for single client fetch', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiResponse.mockRejectedValue(new Error('Client not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClient('nonexistent'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Client not found');
  });
});

describe('useClientCases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches cases for a client', async () => {
    const mockCases = [
      { id: 'case-1', title: 'H-1B Case', visa_type: 'H-1B', status: 'intake', deadline: null, created_at: '2026-01-15T00:00:00Z' },
    ];
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockCases);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClientCases('client-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockCases);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/clients/client-1/cases');
  });

  test('does not fetch when clientId is empty string', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClientCases(''), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });
});

describe('useCreateClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates a client and invalidates queries', async () => {
    const newClient = { ...mockClientData, id: 'client-new' };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(newClient);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateClient(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['clients'] });
  });

  test('handles creation error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Validation error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateClient(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        first_name: '',
        last_name: '',
        email: '',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Validation error');
  });
});

describe('useUpdateClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('updates a client and invalidates queries', async () => {
    const updatedClient = { ...mockClientData, first_name: 'Jane' };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(updatedClient);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateClient(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'client-1',
        data: { first_name: 'Jane' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/clients/client-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: 'Jane' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['clients'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['clients', 'client-1'] });
  });

  test('handles update error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Invalid data'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateClient(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        id: 'client-1',
        data: { first_name: '' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Invalid data');
  });
});

describe('useSearchClients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('searches clients when query is at least 2 characters', async () => {
    const searchResults = [mockClientData];
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(searchResults);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearchClients('Jo'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(searchResults);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/clients/search?q=Jo',
      { timeout: 'QUICK' }
    );
  });

  test('does not search when query is less than 2 characters', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearchClients('J'), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('does not search when query is empty', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearchClients(''), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles search error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Search failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSearchClients('John'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useClientsPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches paginated clients', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockClientsResponse);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClientsPaginated(1, 10), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockClientsResponse);

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('limit=10');
  });

  test('passes search parameter when provided', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockClientsResponse);

    const { Wrapper } = createWrapper();
    renderHook(() => useClientsPaginated(1, 10, 'John'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('search=John');
  });

  test('fetches without search param when not provided', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockClientsResponse);

    const { Wrapper } = createWrapper();
    renderHook(() => useClientsPaginated(2, 25), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(mockFetchWithTimeout).toHaveBeenCalled();
    });

    const calledUrl = mockFetchWithTimeout.mock.calls[0][0] as string;
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('limit=25');
    expect(calledUrl).not.toContain('search=');
  });
});
