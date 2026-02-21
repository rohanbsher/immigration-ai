import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock fetch-with-timeout
const mockFetchWithTimeout = vi.fn();
const mockUploadWithTimeout = vi.fn();
vi.mock('@/lib/api/fetch-with-timeout', () => {
  class MockTimeoutError extends Error {
    constructor(timeout: number) {
      super(`Request timed out after ${timeout / 1000} seconds`);
      this.name = 'TimeoutError';
    }
  }
  return {
    fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
    uploadWithTimeout: (...args: unknown[]) => mockUploadWithTimeout(...args),
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

// Mock job-aware-fetch
const mockFetchJobAware = vi.fn();
vi.mock('@/lib/api/job-aware-fetch', () => ({
  fetchJobAware: (...args: unknown[]) => mockFetchJobAware(...args),
}));

import {
  useDocuments,
  useDocument,
  useUploadDocument,
  useUpdateDocument,
  useVerifyDocument,
  useAnalyzeDocument,
  useDeleteDocument,
  useDocumentChecklist,
} from './use-documents';

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

const mockDocument = {
  id: 'doc-1',
  case_id: 'case-1',
  uploaded_by: 'user-1',
  document_type: 'passport' as const,
  status: 'uploaded' as const,
  file_name: 'passport.pdf',
  file_url: '/files/passport.pdf',
  file_size: 1024000,
  mime_type: 'application/pdf',
  ai_extracted_data: null,
  ai_confidence_score: null,
  verified_by: null,
  verified_at: null,
  expiration_date: '2030-01-01',
  notes: null,
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
  uploader: {
    id: 'user-1',
    first_name: 'Jane',
    last_name: 'Smith',
  },
  verifier: null,
};

describe('useDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches documents for a case', async () => {
    const docs = [mockDocument];
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(docs);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocuments('case-1'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(docs);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/case-1/documents');
  });

  test('does not fetch when caseId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocuments(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles empty documents list', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocuments('case-1'), {
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
    const { result } = renderHook(() => useDocuments('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches a single document by id', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockDocument);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocument('doc-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockDocument);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/documents/doc-1');
  });

  test('does not fetch when id is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocument(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles error for single document fetch', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiResponse.mockRejectedValue(new Error('Document not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocument('nonexistent'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Document not found');
  });
});

describe('useUploadDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('uploads a document and invalidates queries', async () => {
    mockUploadWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockDocument);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUploadDocument(), {
      wrapper: Wrapper,
    });

    const mockFile = new File(['test'], 'passport.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.mutateAsync({
        case_id: 'case-1',
        document_type: 'passport',
        file: mockFile,
        expiration_date: '2030-01-01',
        notes: 'Test notes',
      });
    });

    // Verify upload was called with FormData to the correct endpoint
    expect(mockUploadWithTimeout).toHaveBeenCalled();
    const [url, formData] = mockUploadWithTimeout.mock.calls[0];
    expect(url).toBe('/api/cases/case-1/documents');
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('document_type')).toBe('passport');
    expect(formData.get('file')).toBe(mockFile);
    expect(formData.get('expiration_date')).toBe('2030-01-01');
    expect(formData.get('notes')).toBe('Test notes');

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['documents', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['case', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['billing-usage'] });
  });

  test('uploads without optional fields', async () => {
    mockUploadWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockDocument);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUploadDocument(), {
      wrapper: Wrapper,
    });

    const mockFile = new File(['test'], 'passport.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.mutateAsync({
        case_id: 'case-1',
        document_type: 'passport',
        file: mockFile,
      });
    });

    const [, formData] = mockUploadWithTimeout.mock.calls[0];
    expect(formData.get('expiration_date')).toBeNull();
    expect(formData.get('notes')).toBeNull();
  });

  test('handles upload error', async () => {
    mockUploadWithTimeout.mockResolvedValue({ ok: false, status: 413 });
    mockParseApiResponse.mockRejectedValue(new Error('File too large'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUploadDocument(), {
      wrapper: Wrapper,
    });

    const mockFile = new File(['test'], 'large.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.mutate({
        case_id: 'case-1',
        document_type: 'passport',
        file: mockFile,
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('File too large');
  });
});

describe('useUpdateDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('updates a document and invalidates queries', async () => {
    const updatedDoc = { ...mockDocument, status: 'verified' as const };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(updatedDoc);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateDocument(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'doc-1',
        data: { status: 'verified' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/documents/doc-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verified' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['documents', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['document', 'doc-1'] });
  });

  test('handles update error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Invalid status'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateDocument(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({
        id: 'doc-1',
        data: { status: 'verified' },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Invalid status');
  });
});

describe('useVerifyDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('verifies a document and invalidates queries', async () => {
    const verifiedDoc = {
      ...mockDocument,
      status: 'verified' as const,
      verified_by: 'att-1',
      verified_at: '2026-02-20T10:00:00Z',
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(verifiedDoc);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useVerifyDocument(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('doc-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/documents/doc-1/verify', {
      method: 'POST',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['documents', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['document', 'doc-1'] });
  });

  test('handles verify error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 403 });
    mockParseApiResponse.mockRejectedValue(new Error('Not authorized to verify'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useVerifyDocument(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('doc-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Not authorized to verify');
  });
});

describe('useAnalyzeDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('analyzes a document via job-aware fetch and invalidates queries', async () => {
    const analyzedDoc = {
      ...mockDocument,
      status: 'analyzed' as const,
      ai_extracted_data: { name: 'John Doe' },
      ai_confidence_score: 0.95,
    };
    mockFetchJobAware.mockResolvedValue(analyzedDoc);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAnalyzeDocument(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('doc-1');
    });

    expect(mockFetchJobAware).toHaveBeenCalledWith('/api/documents/doc-1/analyze', {
      method: 'POST',
      timeout: 'AI',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['documents', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['document', 'doc-1'] });
  });

  test('handles analysis error', async () => {
    mockFetchJobAware.mockRejectedValue(new Error('AI service unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAnalyzeDocument(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('doc-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('AI service unavailable');
  });
});

describe('useDeleteDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deletes a document and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteDocument(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'doc-1', caseId: 'case-1' });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/documents/doc-1', {
      method: 'DELETE',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['documents', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['billing-usage'] });
  });

  test('handles delete error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Document not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteDocument(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ id: 'nonexistent', caseId: 'case-1' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Document not found');
  });
});

describe('useDocumentChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches checklist for a visa type', async () => {
    const checklist = [
      { documentType: 'passport', required: true, description: 'Valid passport' },
      { documentType: 'i94', required: true, description: 'I-94 record' },
    ];
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(checklist);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentChecklist('H-1B'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(checklist);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/document-checklists/H-1B');
  });

  test('does not fetch when visaType is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentChecklist(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles checklist fetch error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiResponse.mockRejectedValue(new Error('Checklist not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentChecklist('UNKNOWN'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
