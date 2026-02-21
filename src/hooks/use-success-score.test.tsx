import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock job-aware-fetch
const mockFetchJobAware = vi.fn();
vi.mock('@/lib/api/job-aware-fetch', () => ({
  fetchJobAware: (...args: unknown[]) => mockFetchJobAware(...args),
}));

import {
  useSuccessScore,
  useInvalidateSuccessScore,
  getSuccessScoreColors,
  getSuccessScoreLabel,
  getFactorStatusInfo,
} from './use-success-score';

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

const mockSuccessScoreData = {
  caseId: 'case-123',
  overallScore: 78,
  factors: [
    { name: 'Document Completeness', score: 85, status: 'good' as const, description: 'All required docs present' },
    { name: 'Form Accuracy', score: 70, status: 'warning' as const, description: 'Some fields need review' },
  ],
  generatedAt: '2026-02-20T10:00:00Z',
};

describe('useSuccessScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns loading state initially', () => {
    mockFetchJobAware.mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSuccessScore('case-123'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  test('fetches success score on mount', async () => {
    mockFetchJobAware.mockResolvedValue(mockSuccessScoreData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSuccessScore('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockSuccessScoreData);
    expect(result.current.error).toBeNull();
    expect(mockFetchJobAware).toHaveBeenCalledWith(
      '/api/cases/case-123/success-score',
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
  });

  test('does not fetch when caseId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSuccessScore(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchJobAware).not.toHaveBeenCalled();
  });

  test('does not fetch when enabled is false', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useSuccessScore('case-123', { enabled: false }),
      { wrapper: Wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchJobAware).not.toHaveBeenCalled();
  });

  test('handles fetch errors', async () => {
    mockFetchJobAware.mockRejectedValue(new Error('AI service unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSuccessScore('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('AI service unavailable');
  });

  test('accepts custom staleTime', async () => {
    mockFetchJobAware.mockResolvedValue(mockSuccessScoreData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useSuccessScore('case-123', { staleTime: 120000 }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockSuccessScoreData);
  });
});

describe('useInvalidateSuccessScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('invalidateCase invalidates a specific case query', () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateSuccessScore(), {
      wrapper: Wrapper,
    });

    result.current.invalidateCase('case-123');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['success-score', 'case-123'],
    });
  });

  test('invalidateAll invalidates all success score queries', () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateSuccessScore(), {
      wrapper: Wrapper,
    });

    result.current.invalidateAll();

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['success-score'],
    });
  });
});

describe('getSuccessScoreColors', () => {
  test('returns success colors for score >= 80', () => {
    const colors = getSuccessScoreColors(80);
    expect(colors.bg).toBe('bg-success/10');
    expect(colors.text).toBe('text-success');
    expect(colors.border).toBe('border-success');
    expect(colors.gradient).toBe('from-success to-success/70');
  });

  test('returns success colors for score of 95', () => {
    const colors = getSuccessScoreColors(95);
    expect(colors.text).toBe('text-success');
  });

  test('returns info colors for score >= 60 and < 80', () => {
    const colors = getSuccessScoreColors(60);
    expect(colors.bg).toBe('bg-info/10');
    expect(colors.text).toBe('text-info');
    expect(colors.border).toBe('border-info');
    expect(colors.gradient).toBe('from-info to-info/70');
  });

  test('returns warning colors for score >= 40 and < 60', () => {
    const colors = getSuccessScoreColors(40);
    expect(colors.bg).toBe('bg-warning/10');
    expect(colors.text).toBe('text-warning');
    expect(colors.border).toBe('border-warning');
    expect(colors.gradient).toBe('from-warning to-warning/70');
  });

  test('returns destructive colors for score < 40', () => {
    const colors = getSuccessScoreColors(20);
    expect(colors.bg).toBe('bg-destructive/10');
    expect(colors.text).toBe('text-destructive');
    expect(colors.border).toBe('border-destructive');
    expect(colors.gradient).toBe('from-destructive to-destructive/70');
  });
});

describe('getSuccessScoreLabel', () => {
  test('returns Excellent for score >= 80', () => {
    expect(getSuccessScoreLabel(80)).toBe('Excellent');
    expect(getSuccessScoreLabel(100)).toBe('Excellent');
  });

  test('returns Good for score >= 60 and < 80', () => {
    expect(getSuccessScoreLabel(60)).toBe('Good');
    expect(getSuccessScoreLabel(79)).toBe('Good');
  });

  test('returns Fair for score >= 40 and < 60', () => {
    expect(getSuccessScoreLabel(40)).toBe('Fair');
    expect(getSuccessScoreLabel(59)).toBe('Fair');
  });

  test('returns Needs Work for score < 40', () => {
    expect(getSuccessScoreLabel(0)).toBe('Needs Work');
    expect(getSuccessScoreLabel(39)).toBe('Needs Work');
  });
});

describe('getFactorStatusInfo', () => {
  test('returns check info for good status', () => {
    const info = getFactorStatusInfo('good');
    expect(info.icon).toBe('check');
    expect(info.color).toBe('text-success');
    expect(info.bgColor).toBe('bg-success/10');
  });

  test('returns alert info for warning status', () => {
    const info = getFactorStatusInfo('warning');
    expect(info.icon).toBe('alert');
    expect(info.color).toBe('text-warning');
    expect(info.bgColor).toBe('bg-warning/10');
  });

  test('returns x info for poor status', () => {
    const info = getFactorStatusInfo('poor');
    expect(info.icon).toBe('x');
    expect(info.color).toBe('text-destructive');
    expect(info.bgColor).toBe('bg-destructive/10');
  });
});
