import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import type { RFEAssessmentResult } from '@/lib/ai/rfe/types';

// Mock the job-aware fetch
const mockFetchJobAware = vi.fn();
vi.mock('@/lib/api/job-aware-fetch', () => ({
  fetchJobAware: (...args: unknown[]) => mockFetchJobAware(...args),
}));

import { useRFEAssessment, useInvalidateRFEAssessment, getRFERiskInfo } from './use-rfe-assessment';

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

const mockAssessment: RFEAssessmentResult = {
  caseId: 'case-123',
  visaType: 'H-1B',
  rfeRiskScore: 35,
  riskLevel: 'medium',
  estimatedRFEProbability: 0.42,
  triggeredRules: [
    {
      ruleId: 'h1b-speciality-docs',
      severity: 'high',
      category: 'document_presence',
      title: 'Missing specialty occupation evidence',
      description: 'No degree evaluation uploaded',
      recommendation: 'Upload credential evaluation report',
      evidence: ['No degree evaluation found'],
      confidence: 0.9,
    },
  ],
  safeRuleIds: ['h1b-lca-present'],
  priorityActions: ['Upload credential evaluation report'],
  dataConfidence: 0.75,
  assessedAt: '2026-02-20T10:00:00Z',
  assessmentVersion: '1.0.0',
};

describe('useRFEAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns loading state initially', () => {
    mockFetchJobAware.mockReturnValue(new Promise(() => {}));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRFEAssessment('case-123'), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  test('returns assessment data on success', async () => {
    mockFetchJobAware.mockResolvedValue(mockAssessment);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRFEAssessment('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockAssessment);
    expect(result.current.error).toBeNull();
    expect(mockFetchJobAware).toHaveBeenCalledWith(
      '/api/cases/case-123/rfe-assessment',
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
  });

  test('handles fetch errors', async () => {
    mockFetchJobAware.mockRejectedValue(new Error('Network failure'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRFEAssessment('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network failure');
  });

  test('does not fetch when caseId is undefined', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRFEAssessment(undefined), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchJobAware).not.toHaveBeenCalled();
  });

  test('does not fetch when enabled is false', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRFEAssessment('case-123', { enabled: false }),
      { wrapper: Wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchJobAware).not.toHaveBeenCalled();
  });

  test('does not fetch when caseId is undefined even if enabled is true', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRFEAssessment(undefined, { enabled: true }),
      { wrapper: Wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFetchJobAware).not.toHaveBeenCalled();
  });

  test('refetch triggers a new fetch', async () => {
    mockFetchJobAware.mockResolvedValue(mockAssessment);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRFEAssessment('case-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetchJobAware).toHaveBeenCalledTimes(1);

    const updatedAssessment = { ...mockAssessment, rfeRiskScore: 50 };
    mockFetchJobAware.mockResolvedValue(updatedAssessment);

    result.current.refetch();

    await waitFor(() => {
      expect(result.current.data?.rfeRiskScore).toBe(50);
    });

    expect(mockFetchJobAware).toHaveBeenCalledTimes(2);
  });

  test('accepts custom staleTime', async () => {
    mockFetchJobAware.mockResolvedValue(mockAssessment);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRFEAssessment('case-123', { staleTime: 60000 }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockAssessment);
  });
});

describe('useInvalidateRFEAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('invalidateCase invalidates a specific case query', async () => {
    mockFetchJobAware.mockResolvedValue(mockAssessment);

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // First, load the assessment
    const { result: assessmentResult } = renderHook(
      () => useRFEAssessment('case-123'),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(assessmentResult.current.isLoading).toBe(false);
    });

    // Then render the invalidation hook
    const { result: invalidateResult } = renderHook(
      () => useInvalidateRFEAssessment(),
      { wrapper: Wrapper }
    );

    invalidateResult.current.invalidateCase('case-123');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['rfe-assessment', 'case-123'],
    });
  });

  test('invalidateAll invalidates all RFE assessment queries', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateRFEAssessment(), {
      wrapper: Wrapper,
    });

    result.current.invalidateAll();

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['rfe-assessment'],
    });
  });
});

describe('getRFERiskInfo', () => {
  test('returns correct info for low risk', () => {
    const info = getRFERiskInfo('low');
    expect(info.label).toBe('Low RFE Risk');
    expect(info.color).toBe('text-success');
    expect(info.bgColor).toBe('bg-success/10');
  });

  test('returns correct info for medium risk', () => {
    const info = getRFERiskInfo('medium');
    expect(info.label).toBe('Medium RFE Risk');
    expect(info.color).toBe('text-warning');
    expect(info.bgColor).toBe('bg-warning/10');
  });

  test('returns correct info for high risk', () => {
    const info = getRFERiskInfo('high');
    expect(info.label).toBe('High RFE Risk');
    expect(info.color).toBe('text-orange-600');
    expect(info.bgColor).toBe('bg-orange-600/10');
  });

  test('returns correct info for critical risk', () => {
    const info = getRFERiskInfo('critical');
    expect(info.label).toBe('Critical RFE Risk');
    expect(info.color).toBe('text-destructive');
    expect(info.bgColor).toBe('bg-destructive/10');
  });

  test('returns unknown for unrecognized risk level', () => {
    const info = getRFERiskInfo('extreme');
    expect(info.label).toBe('Unknown');
    expect(info.color).toBe('text-muted-foreground');
    expect(info.bgColor).toBe('bg-muted');
  });

  test('returns unknown for empty string', () => {
    const info = getRFERiskInfo('');
    expect(info.label).toBe('Unknown');
  });
});
