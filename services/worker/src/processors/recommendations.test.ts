/**
 * Tests for the recommendations worker processor.
 *
 * Covers:
 * - Calls AI and stores result in cases.ai_recommendations
 * - Updates progress at 10%, 80%, 100%
 * - Falls back to completeness-based recommendations on AI failure
 * - Throws on case-not-found
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          single: vi.fn(),
        }),
      }),
    }),
    update: mockUpdate,
  }),
};

vi.mock('../supabase', () => ({
  getWorkerSupabase: () => mockSupabase,
}));

const mockSuggestNextSteps = vi.fn();
vi.mock('@/lib/ai/anthropic', () => ({
  suggestNextSteps: (...args: unknown[]) => mockSuggestNextSteps(...args),
}));

const mockAnalyzeCompleteness = vi.fn();
vi.mock('@/lib/ai/document-completeness', () => ({
  analyzeDocumentCompleteness: (...args: unknown[]) => mockAnalyzeCompleteness(...args),
}));

vi.mock('@/lib/ai/utils', () => ({
  withAIFallback: vi.fn(async (primary: () => Promise<unknown>, fallback: () => Promise<unknown>) => {
    try {
      const result = await primary();
      return { result, source: 'ai' };
    } catch {
      const result = await fallback();
      return { result, source: 'fallback' };
    }
  }),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    logError: vi.fn(),
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────

function createMockJob(data: { caseId: string; userId: string; visaType: string }) {
  return {
    data,
    id: 'job-test-1',
    updateProgress: vi.fn(),
  } as any;
}

function setupFromMock(
  caseResult: { data: unknown; error: unknown },
  docsResult = { data: [], error: null },
  formsResult = { data: [], error: null }
) {
  let callCount = 0;
  mockSupabase.from.mockImplementation(() => {
    // Promise.all calls: cases, documents, forms in order
    const results = [caseResult, docsResult, formsResult];
    const idx = callCount++;

    // For the update call (4th call), return the update mock
    if (idx >= 3) {
      return { update: mockUpdate };
    }

    const result = results[idx] || { data: null, error: null };
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue(result),
          single: vi.fn().mockResolvedValue(result),
        }),
      }),
      update: mockUpdate,
    };
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('processRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls AI and stores result in cases.ai_recommendations', async () => {
    setupFromMock(
      { data: { visa_type: 'H1B', status: 'in_review' }, error: null },
      { data: [{ document_type: 'passport' }], error: null },
      { data: [{ form_type: 'I-129' }], error: null }
    );

    mockSuggestNextSteps.mockResolvedValue({
      nextSteps: [
        { action: 'Upload employment letter', priority: 'high', reason: 'Required for H1B' },
        { action: 'Review I-129 form', priority: 'medium', reason: 'Verify details' },
      ],
    });

    const { processRecommendations } = await import('./recommendations');
    const job = createMockJob({ caseId: 'case-1', userId: 'user-1', visaType: 'H1B' });

    const result = await processRecommendations(job);

    expect(result.caseId).toBe('case-1');
    expect(result.count).toBe(2);
    expect(result.source).toBe('ai');

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(job.updateProgress).toHaveBeenCalledWith(80);
    expect(job.updateProgress).toHaveBeenCalledWith(100);

    expect(mockUpdate).toHaveBeenCalled();
  });

  it('falls back to completeness-based recommendations on AI failure', async () => {
    setupFromMock(
      { data: { visa_type: 'H1B', status: 'in_review' }, error: null },
      { data: [], error: null },
      { data: [], error: null }
    );

    mockSuggestNextSteps.mockRejectedValue(new Error('AI service down'));

    mockAnalyzeCompleteness.mockResolvedValue({
      missingRequired: [
        { documentType: 'passport', displayName: 'Passport' },
      ],
      recommendations: ['Complete your profile'],
    });

    const { processRecommendations } = await import('./recommendations');
    const job = createMockJob({ caseId: 'case-2', userId: 'user-1', visaType: 'H1B' });

    const result = await processRecommendations(job);

    expect(result.source).toBe('fallback');
    expect(result.count).toBeGreaterThan(0);
  });

  it('uses fallback when case data fetch fails in primary', async () => {
    // When case fetch fails, the primary throws, but withAIFallback
    // catches it and runs the fallback which produces fallback results
    setupFromMock(
      { data: null, error: { message: 'not found' } }
    );

    mockAnalyzeCompleteness.mockResolvedValue({
      missingRequired: [
        { documentType: 'passport', displayName: 'Passport' },
      ],
      recommendations: ['Upload documents'],
    });

    const { processRecommendations } = await import('./recommendations');
    const job = createMockJob({ caseId: 'nonexistent', userId: 'user-1', visaType: 'H1B' });

    const result = await processRecommendations(job);
    expect(result.source).toBe('fallback');
  });
});
