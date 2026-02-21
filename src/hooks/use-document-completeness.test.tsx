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
  useDocumentCompleteness,
  useInvalidateCompleteness,
  getCompletenessColor,
  getFilingReadinessInfo,
} from './use-document-completeness';

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

const mockCompletenessData = {
  caseId: 'case-123',
  overallCompleteness: 75,
  filingReadiness: 'needs_review' as const,
  categories: [
    { name: 'Identity Documents', completeness: 100, required: 2, present: 2 },
    { name: 'Employment Documents', completeness: 50, required: 4, present: 2 },
  ],
  missingDocuments: [
    { name: 'Employment Letter', category: 'Employment Documents', required: true },
  ],
  generatedAt: '2026-02-20T10:00:00Z',
};

describe('useDocumentCompleteness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns loading state initially', () => {
    mockFetchJobAware.mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentCompleteness('case-123'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  test('fetches document completeness on mount', async () => {
    mockFetchJobAware.mockResolvedValue(mockCompletenessData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentCompleteness('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockCompletenessData);
    expect(result.current.error).toBeNull();
    expect(mockFetchJobAware).toHaveBeenCalledWith(
      '/api/cases/case-123/completeness',
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
  });

  test('does not fetch when caseId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentCompleteness(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchJobAware).not.toHaveBeenCalled();
  });

  test('does not fetch when enabled is false', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useDocumentCompleteness('case-123', { enabled: false }),
      { wrapper: Wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchJobAware).not.toHaveBeenCalled();
  });

  test('handles fetch errors', async () => {
    mockFetchJobAware.mockRejectedValue(new Error('Network failure'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentCompleteness('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network failure');
  });

  test('accepts custom staleTime', async () => {
    mockFetchJobAware.mockResolvedValue(mockCompletenessData);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useDocumentCompleteness('case-123', { staleTime: 60000 }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockCompletenessData);
  });
});

describe('useInvalidateCompleteness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('invalidateCase invalidates a specific case query', () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateCompleteness(), {
      wrapper: Wrapper,
    });

    result.current.invalidateCase('case-123');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['document-completeness', 'case-123'],
    });
  });

  test('invalidateAll invalidates all completeness queries', () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateCompleteness(), {
      wrapper: Wrapper,
    });

    result.current.invalidateAll();

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['document-completeness'],
    });
  });
});

describe('getCompletenessColor', () => {
  test('returns success colors for 100% completeness', () => {
    const colors = getCompletenessColor(100);
    expect(colors.bg).toBe('bg-success/10');
    expect(colors.text).toBe('text-success');
    expect(colors.ring).toBe('ring-success');
  });

  test('returns warning colors for 70-99% completeness', () => {
    const colors = getCompletenessColor(75);
    expect(colors.bg).toBe('bg-warning/10');
    expect(colors.text).toBe('text-warning');
    expect(colors.ring).toBe('ring-warning');
  });

  test('returns warning colors for 40-69% completeness', () => {
    const colors = getCompletenessColor(50);
    expect(colors.bg).toBe('bg-warning/10');
    expect(colors.text).toBe('text-warning');
    expect(colors.ring).toBe('ring-warning');
  });

  test('returns destructive colors for < 40% completeness', () => {
    const colors = getCompletenessColor(20);
    expect(colors.bg).toBe('bg-destructive/10');
    expect(colors.text).toBe('text-destructive');
    expect(colors.ring).toBe('ring-destructive');
  });

  test('returns destructive colors for 0% completeness', () => {
    const colors = getCompletenessColor(0);
    expect(colors.bg).toBe('bg-destructive/10');
    expect(colors.text).toBe('text-destructive');
  });
});

describe('getFilingReadinessInfo', () => {
  test('returns ready info', () => {
    const info = getFilingReadinessInfo('ready');
    expect(info.label).toBe('Ready to File');
    expect(info.color).toBe('text-success');
    expect(info.bgColor).toBe('bg-success/10');
  });

  test('returns needs review info', () => {
    const info = getFilingReadinessInfo('needs_review');
    expect(info.label).toBe('Needs Review');
    expect(info.color).toBe('text-warning');
    expect(info.bgColor).toBe('bg-warning/10');
  });

  test('returns incomplete info', () => {
    const info = getFilingReadinessInfo('incomplete');
    expect(info.label).toBe('Incomplete');
    expect(info.color).toBe('text-destructive');
    expect(info.bgColor).toBe('bg-destructive/10');
  });
});
