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

// Mock job-aware-fetch
const mockFetchJobAware = vi.fn();
vi.mock('@/lib/api/job-aware-fetch', () => ({
  fetchJobAware: (...args: unknown[]) => mockFetchJobAware(...args),
}));

import {
  useForms,
  useForm,
  useCreateForm,
  useUpdateForm,
  useAutofillForm,
  useReviewForm,
  useFileForm,
  useDeleteForm,
} from './use-forms';

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

const mockForm = {
  id: 'form-1',
  case_id: 'case-1',
  form_type: 'I-485' as const,
  status: 'draft' as const,
  form_data: { applicantName: 'John Doe' },
  ai_filled_data: null,
  ai_confidence_scores: null,
  review_notes: null,
  reviewed_by: null,
  reviewed_at: null,
  filed_at: null,
  created_at: '2026-02-20T10:00:00Z',
  updated_at: '2026-02-20T10:00:00Z',
};

const mockFormsList = [
  mockForm,
  {
    ...mockForm,
    id: 'form-2',
    form_type: 'I-130' as const,
    status: 'ai_filled' as const,
  },
];

describe('useForms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches forms for a case', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockFormsList);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useForms('case-1'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockFormsList);
    expect(result.current.error).toBeNull();
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/case-1/forms');
  });

  test('does not fetch when caseId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useForms(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles fetch errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useForms('case-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches a single form by id', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockForm);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useForm('form-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockForm);
    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/forms/form-1');
  });

  test('does not fetch when id is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useForm(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  test('handles error for single form fetch', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiResponse.mockRejectedValue(new Error('Form not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useForm('nonexistent'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Form not found');
  });
});

describe('useCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('creates a form and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockForm);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateForm(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        case_id: 'case-1',
        form_type: 'I-485',
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/case-1/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: 'case-1', form_type: 'I-485' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['forms', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['case', 'case-1'] });
  });

  test('handles creation errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 400 });
    mockParseApiResponse.mockRejectedValue(new Error('Validation error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ case_id: 'case-1', form_type: 'I-485' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Validation error');
  });
});

describe('useUpdateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('updates a form and invalidates related queries', async () => {
    const updatedForm = { ...mockForm, status: 'in_review' as const };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(updatedForm);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateForm(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'form-1',
        data: { status: 'in_review' },
      });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/forms/form-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_review' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['forms', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['form', 'form-1'] });
  });

  test('handles update errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 403 });
    mockParseApiResponse.mockRejectedValue(new Error('Forbidden'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ id: 'form-1', data: { status: 'in_review' } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Forbidden');
  });
});

describe('useAutofillForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('triggers AI autofill via job-aware fetch', async () => {
    const autofilledForm = {
      ...mockForm,
      status: 'ai_filled' as const,
      ai_filled_data: { field1: 'value1' },
      ai_confidence_scores: { field1: 0.95 },
    };
    mockFetchJobAware.mockResolvedValue(autofilledForm);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAutofillForm(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('form-1');
    });

    expect(mockFetchJobAware).toHaveBeenCalledWith('/api/forms/form-1/autofill', {
      method: 'POST',
      timeout: 'AI',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['forms', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['form', 'form-1'] });
  });

  test('handles autofill errors', async () => {
    mockFetchJobAware.mockRejectedValue(new Error('AI service unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAutofillForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate('form-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('AI service unavailable');
  });
});

describe('useReviewForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('reviews a form and invalidates queries', async () => {
    const reviewedForm = {
      ...mockForm,
      status: 'approved' as const,
      review_notes: 'Looks good',
      reviewed_by: 'attorney-1',
      reviewed_at: '2026-02-20T12:00:00Z',
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(reviewedForm);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useReviewForm(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'form-1', notes: 'Looks good' });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/forms/form-1/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Looks good' }),
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['forms', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['form', 'form-1'] });
  });
});

describe('useFileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('files a form and invalidates queries', async () => {
    const filedForm = {
      ...mockForm,
      status: 'filed' as const,
      filed_at: '2026-02-20T12:00:00Z',
    };
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(filedForm);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useFileForm(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync('form-1');
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/forms/form-1/file', {
      method: 'POST',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['forms', 'case-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['form', 'form-1'] });
  });
});

describe('useDeleteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('deletes a form and invalidates queries', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteForm(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'form-1', caseId: 'case-1' });
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/forms/form-1', {
      method: 'DELETE',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['forms', 'case-1'] });
  });

  test('handles delete errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 404 });
    mockParseApiVoidResponse.mockRejectedValue(new Error('Form not found'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ id: 'nonexistent', caseId: 'case-1' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Form not found');
  });
});
