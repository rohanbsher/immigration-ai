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
  useDocumentRequests,
  useCreateDocumentRequest,
  useUpdateDocumentRequest,
  useDeleteDocumentRequest,
  useMarkRequestAsUploaded,
  useMarkRequestAsFulfilled,
} from './use-document-requests';
import type { DocumentRequest } from './use-document-requests';

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

const mockRequest: DocumentRequest = {
  id: 'req-1',
  case_id: 'case-1',
  requested_by: 'attorney-1',
  document_type: 'passport',
  status: 'pending',
  title: 'Passport Copy Required',
  description: 'Please upload a clear copy of your passport.',
  due_date: '2026-03-01',
  priority: 'high',
  fulfilled_by_document_id: null,
  fulfilled_at: null,
  created_at: '2026-02-20T10:00:00Z',
  updated_at: '2026-02-20T10:00:00Z',
  requester: {
    id: 'attorney-1',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@firm.com',
  },
};

const mockRequestsList: DocumentRequest[] = [
  mockRequest,
  {
    ...mockRequest,
    id: 'req-2',
    document_type: 'birth_certificate',
    title: 'Birth Certificate',
    priority: 'normal',
  },
];

describe('useDocumentRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches document requests for a case', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ data: mockRequestsList });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentRequests('case-1'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // The hook uses select: (data) => data.data, so result.current.data should be the array
    expect(result.current.data).toEqual(mockRequestsList);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/cases/case-1/document-requests?'
    );
  });

  test('fetches only pending requests when pendingOnly is true', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ data: [mockRequest] });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentRequests('case-1', true), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/cases/case-1/document-requests?pending=true'
    );
  });

  test('does not fetch when caseId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentRequests(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles fetch errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentRequests('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useCreateDocumentRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates a document request and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockRequest);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateDocumentRequest('case-1'), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        document_type: 'passport',
        title: 'Passport Copy Required',
        description: 'Please upload a clear copy of your passport.',
        priority: 'high',
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/cases/case-1/document-requests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: 'passport',
          title: 'Passport Copy Required',
          description: 'Please upload a clear copy of your passport.',
          priority: 'high',
        }),
      }
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['document-requests', 'case-1'],
    });
  });

  test('throws error when caseId is undefined', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateDocumentRequest(undefined), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        document_type: 'passport',
        title: 'Test',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Case ID is required');
  });

  test('handles creation errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Validation failed'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateDocumentRequest('case-1'), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        document_type: 'passport',
        title: '',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Validation failed');
  });
});

describe('useUpdateDocumentRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('updates a document request and invalidates queries', async () => {
    const updatedRequest = { ...mockRequest, status: 'fulfilled' as const };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(updatedRequest);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateDocumentRequest('case-1'), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'req-1',
        data: { status: 'fulfilled' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/document-requests/req-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'fulfilled' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['document-requests', 'case-1'],
    });
  });

  test('handles update errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 403 });
    mockParseApiResponse.mockRejectedValue(new Error('Forbidden'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateDocumentRequest('case-1'), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        id: 'req-1',
        data: { priority: 'urgent' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Forbidden');
  });
});

describe('useDeleteDocumentRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deletes a document request and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteDocumentRequest('case-1'), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('req-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/document-requests/req-1', {
      method: 'DELETE',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['document-requests', 'case-1'],
    });
  });

  test('handles delete errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Request not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteDocumentRequest('case-1'), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('nonexistent');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Request not found');
  });
});

describe('useMarkRequestAsUploaded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('marks a request as uploaded with document id', async () => {
    const uploadedRequest = {
      ...mockRequest,
      status: 'uploaded' as const,
      fulfilled_by_document_id: 'doc-1',
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(uploadedRequest);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMarkRequestAsUploaded('case-1'), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ requestId: 'req-1', documentId: 'doc-1' });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/document-requests/req-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'uploaded',
        fulfilled_by_document_id: 'doc-1',
      }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['document-requests', 'case-1'],
    });
  });
});

describe('useMarkRequestAsFulfilled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('marks a request as fulfilled', async () => {
    const fulfilledRequest = { ...mockRequest, status: 'fulfilled' as const };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(fulfilledRequest);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMarkRequestAsFulfilled('case-1'), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('req-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/document-requests/req-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'fulfilled' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['document-requests', 'case-1'],
    });
  });

  test('handles fulfill errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Cannot fulfill'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMarkRequestAsFulfilled('case-1'), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('req-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Cannot fulfill');
  });
});
