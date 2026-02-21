import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock job-aware-fetch
const mockFetchJobAware = vi.fn();
vi.mock('@/lib/api/job-aware-fetch', () => ({
  fetchJobAware: (...args: unknown[]) => mockFetchJobAware(...args),
}));

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
  useRecommendations,
  useUpdateRecommendation,
  useInvalidateRecommendations,
  getPriorityColors,
  getCategoryIcon,
  getPriorityLabel,
} from './use-recommendations';

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

const mockRecommendationsData = {
  caseId: 'case-123',
  recommendations: [
    {
      id: 'rec-1',
      priority: 'high' as const,
      action: 'Upload passport copy',
      reason: 'Required for I-485 filing',
      category: 'document' as const,
      actionUrl: '/cases/case-123/documents',
    },
    {
      id: 'rec-2',
      priority: 'medium' as const,
      action: 'Review I-130 form',
      reason: 'Form needs attorney review',
      category: 'form' as const,
    },
  ],
  generatedAt: '2026-02-20T10:00:00Z',
  expiresAt: '2026-02-20T11:00:00Z',
  source: 'ai' as const,
};

describe('useRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns loading state initially', () => {
    mockFetchJobAware.mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRecommendations('case-123'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  test('fetches recommendations on mount', async () => {
    mockFetchJobAware.mockResolvedValue(mockRecommendationsData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRecommendations('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockRecommendationsData);
    expect(result.current.error).toBeNull();
    expect(mockFetchJobAware).toHaveBeenCalledWith(
      '/api/cases/case-123/recommendations',
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
  });

  test('does not fetch when caseId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRecommendations(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchJobAware).not.toHaveBeenCalled();
  });

  test('does not fetch when enabled is false', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRecommendations('case-123', { enabled: false }),
      { wrapper: Wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchJobAware).not.toHaveBeenCalled();
  });

  test('handles fetch errors', async () => {
    mockFetchJobAware.mockRejectedValue(new Error('Network failure'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRecommendations('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network failure');
  });

  test('forceRefresh fetches with refresh=true and updates cache', async () => {
    mockFetchJobAware.mockResolvedValue(mockRecommendationsData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRecommendations('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const refreshedData = {
      ...mockRecommendationsData,
      source: 'ai' as const,
      generatedAt: '2026-02-20T12:00:00Z',
    };
    mockFetchJobAware.mockResolvedValue(refreshedData);

    await act(async () => {
      await result.current.forceRefresh();
    });

    // Second call should use refresh=true
    expect(mockFetchJobAware).toHaveBeenCalledWith(
      '/api/cases/case-123/recommendations?refresh=true',
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
  });

  test('refetch triggers a new fetch', async () => {
    mockFetchJobAware.mockResolvedValue(mockRecommendationsData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRecommendations('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchJobAware).toHaveBeenCalledTimes(1);

    const updatedData = {
      ...mockRecommendationsData,
      recommendations: [],
    };
    mockFetchJobAware.mockResolvedValue(updatedData);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockFetchJobAware).toHaveBeenCalledTimes(2);
  });

  test('accepts custom staleTime', async () => {
    mockFetchJobAware.mockResolvedValue(mockRecommendationsData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRecommendations('case-123', { staleTime: 60000 }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockRecommendationsData);
  });
});

describe('useUpdateRecommendation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('completeRecommendation sends PATCH with complete action', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ success: true });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateRecommendation('case-123'), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.completeRecommendation('rec-1');
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false);
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/cases/case-123/recommendations',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: 'rec-1', action: 'complete' }),
      }
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['recommendations', 'case-123'],
    });
  });

  test('dismissRecommendation sends PATCH with dismiss action', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ success: true });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateRecommendation('case-123'), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.dismissRecommendation('rec-2');
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false);
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/api/cases/case-123/recommendations',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: 'rec-2', action: 'dismiss' }),
      }
    );
  });

  test('handles update errors', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('Server error'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateRecommendation('case-123'), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.completeRecommendation('rec-1');
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    expect(result.current.error?.message).toBe('Server error');
  });
});

describe('useInvalidateRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('invalidateCase invalidates a specific case query', () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateRecommendations(), {
      wrapper: Wrapper,
    });

    result.current.invalidateCase('case-123');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['recommendations', 'case-123'],
    });
  });

  test('invalidateAll invalidates all recommendations queries', () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateRecommendations(), {
      wrapper: Wrapper,
    });

    result.current.invalidateAll();

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['recommendations'],
    });
  });
});

describe('getPriorityColors', () => {
  test('returns red colors for high priority', () => {
    const colors = getPriorityColors('high');
    expect(colors.bg).toBe('bg-red-50');
    expect(colors.text).toBe('text-red-700');
    expect(colors.border).toBe('border-red-200');
    expect(colors.dot).toBe('bg-red-500');
  });

  test('returns yellow colors for medium priority', () => {
    const colors = getPriorityColors('medium');
    expect(colors.bg).toBe('bg-yellow-50');
    expect(colors.text).toBe('text-yellow-700');
    expect(colors.border).toBe('border-yellow-200');
    expect(colors.dot).toBe('bg-yellow-500');
  });

  test('returns blue colors for low priority', () => {
    const colors = getPriorityColors('low');
    expect(colors.bg).toBe('bg-blue-50');
    expect(colors.text).toBe('text-blue-700');
    expect(colors.border).toBe('border-blue-200');
    expect(colors.dot).toBe('bg-blue-500');
  });
});

describe('getCategoryIcon', () => {
  test('returns FileText for document category', () => {
    expect(getCategoryIcon('document')).toBe('FileText');
  });

  test('returns ClipboardList for form category', () => {
    expect(getCategoryIcon('form')).toBe('ClipboardList');
  });

  test('returns Clock for deadline category', () => {
    expect(getCategoryIcon('deadline')).toBe('Clock');
  });

  test('returns Eye for review category', () => {
    expect(getCategoryIcon('review')).toBe('Eye');
  });

  test('returns Lightbulb for other/unknown category', () => {
    expect(getCategoryIcon('other')).toBe('Lightbulb');
  });
});

describe('getPriorityLabel', () => {
  test('returns High Priority for high', () => {
    expect(getPriorityLabel('high')).toBe('High Priority');
  });

  test('returns Medium Priority for medium', () => {
    expect(getPriorityLabel('medium')).toBe('Medium Priority');
  });

  test('returns Low Priority for low', () => {
    expect(getPriorityLabel('low')).toBe('Low Priority');
  });
});
