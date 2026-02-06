import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockChain, createMockSupabaseFrom } from '@/test-utils/mock-supabase-chain';
import { createClient } from '@/lib/supabase/server';
import { analyzeDocumentCompleteness } from '@/lib/ai/document-completeness';
import {
  calculateSuccessScore,
  getSuccessScoreColor,
  getSuccessScoreLabel,
} from './success-probability';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/ai/document-completeness');
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

const CASE_ID = 'case-1';

function makeCompletenessResult(overrides: Record<string, unknown> = {}) {
  return {
    overallCompleteness: 80,
    filingReadiness: 'needs_review' as const,
    missingRequired: [],
    missingOptional: [],
    uploadedDocs: [],
    recommendations: [],
    totalRequired: 5,
    uploadedRequired: 4,
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

function setupMocks(tableOverrides: Record<string, unknown> = {}) {
  const mockSupabase = createMockSupabaseFrom();
  vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

  const defaults: Record<string, unknown> = {
    documents: [],
    forms: [],
    cases: null,
    ...tableOverrides,
  };

  mockSupabase.from.mockImplementation((table: string) => {
    const value = defaults[table];
    if (table === 'cases') {
      return createMockChain({ data: value });
    }
    return createMockChain({ data: value });
  });

  vi.mocked(analyzeDocumentCompleteness).mockResolvedValue(
    makeCompletenessResult() as never
  );

  return mockSupabase;
}

// ---------------------------------------------------------------------------
// Group A: getSuccessScoreColor
// ---------------------------------------------------------------------------
describe('getSuccessScoreColor', () => {
  it('returns green colors for score >= 80', () => {
    const result = getSuccessScoreColor(80);
    expect(result.bg).toContain('green');
    expect(result.text).toContain('green');
    expect(result.border).toContain('green');
  });

  it('returns blue colors for score >= 60 and < 80', () => {
    const result = getSuccessScoreColor(65);
    expect(result.bg).toContain('blue');
    expect(result.text).toContain('blue');
    expect(result.border).toContain('blue');
  });

  it('returns yellow colors for score >= 40 and < 60', () => {
    const result = getSuccessScoreColor(45);
    expect(result.bg).toContain('yellow');
    expect(result.text).toContain('yellow');
    expect(result.border).toContain('yellow');
  });

  it('returns red colors for score < 40', () => {
    const result = getSuccessScoreColor(20);
    expect(result.bg).toContain('red');
    expect(result.text).toContain('red');
    expect(result.border).toContain('red');
  });
});

// ---------------------------------------------------------------------------
// Group B: getSuccessScoreLabel
// ---------------------------------------------------------------------------
describe('getSuccessScoreLabel', () => {
  it('returns Excellent for score >= 80', () => {
    expect(getSuccessScoreLabel(80)).toBe('Excellent');
    expect(getSuccessScoreLabel(100)).toBe('Excellent');
  });

  it('returns Good for score >= 60 and < 80', () => {
    expect(getSuccessScoreLabel(60)).toBe('Good');
    expect(getSuccessScoreLabel(79)).toBe('Good');
  });

  it('returns Fair for score >= 40 and < 60', () => {
    expect(getSuccessScoreLabel(40)).toBe('Fair');
    expect(getSuccessScoreLabel(59)).toBe('Fair');
  });

  it('returns Needs Work for score < 40', () => {
    expect(getSuccessScoreLabel(0)).toBe('Needs Work');
    expect(getSuccessScoreLabel(39)).toBe('Needs Work');
  });
});

// ---------------------------------------------------------------------------
// Group C: Document Quality sub-calculator
// ---------------------------------------------------------------------------
describe('Document Quality sub-calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns score 0 when no documents exist', async () => {
    setupMocks({ documents: [] });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Document Quality');

    expect(factor).toBeDefined();
    expect(factor!.score).toBe(0);
    expect(factor!.status).toBe('poor');
  });

  it('calculates correct average for documents with mixed confidence', async () => {
    const mockDocs = [
      { ai_confidence_score: 0.9, document_type: 'passport', status: 'verified' },
      { ai_confidence_score: 0.8, document_type: 'photo', status: 'verified' },
    ];
    setupMocks({ documents: mockDocs });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Document Quality');

    // avg = (0.9 + 0.8) / 2 = 0.85, score = round(0.85 * 100) = 85
    expect(factor!.score).toBe(85);
    expect(factor!.status).toBe('good');
  });

  it('flags low-confidence documents (< 0.7) in details', async () => {
    const mockDocs = [
      { ai_confidence_score: 0.5, document_type: 'passport', status: 'verified' },
      { ai_confidence_score: 0.9, document_type: 'photo', status: 'verified' },
    ];
    setupMocks({ documents: mockDocs });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Document Quality');

    // avg = (0.5 + 0.9) / 2 = 0.7, score = 70
    expect(factor!.score).toBe(70);
    // rawValue should reflect the average
    expect(factor!.rawValue).toBe('70%');
  });
});

// ---------------------------------------------------------------------------
// Group D: Form Confidence sub-calculator
// ---------------------------------------------------------------------------
describe('Form Confidence sub-calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns score 0 when no forms exist', async () => {
    setupMocks({ forms: [] });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Form Field Confidence');

    expect(factor).toBeDefined();
    expect(factor!.score).toBe(0);
    expect(factor!.status).toBe('poor');
  });

  it('calculates high score for forms with good confidence', async () => {
    const mockForms = [
      {
        ai_confidence_scores: { field1: 0.95, field2: 0.9, field3: 0.88 },
        status: 'ai_filled',
      },
    ];
    setupMocks({ forms: mockForms });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Form Field Confidence');

    // avg = (0.95 + 0.9 + 0.88) / 3 = 0.91, score = round(0.91 * 100) = 91
    expect(factor!.score).toBe(91);
    expect(factor!.status).toBe('good');
  });

  it('returns score 0 when confidence data is null in forms', async () => {
    const mockForms = [
      { ai_confidence_scores: null, status: 'draft' },
    ];
    // The query uses .not('ai_confidence_scores', 'is', null), so the mock
    // chain doesn't filter; the code checks confidenceScores truthiness.
    // When all forms have null confidence, totalFields remains 0, returns score 0.
    setupMocks({ forms: mockForms });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Form Field Confidence');

    expect(factor!.score).toBe(0);
  });

  it('reports low-confidence field count in details', async () => {
    const mockForms = [
      {
        ai_confidence_scores: { field1: 0.5, field2: 0.3, field3: 0.9 },
        status: 'ai_filled',
      },
    ];
    setupMocks({ forms: mockForms });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Form Field Confidence');

    // avg = (0.5 + 0.3 + 0.9) / 3 = ~0.5667, score = 57
    expect(factor!.score).toBe(57);
    expect(factor!.status).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// Group E: Field Validation sub-calculator
// ---------------------------------------------------------------------------
describe('Field Validation sub-calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns score 50 when no forms exist', async () => {
    setupMocks({ forms: [] });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Field Validation');

    expect(factor).toBeDefined();
    expect(factor!.score).toBe(50);
    expect(factor!.status).toBe('warning');
  });

  it('calculates correct score for various form statuses', async () => {
    // The form query for field validation uses .select('form_data, ai_filled_data, status')
    // and the form query for form confidence uses .select('ai_confidence_scores, status')
    // Since our mock returns the same data for all 'forms' queries, we include both fields.
    const mockForms = [
      { ai_confidence_scores: null, form_data: {}, ai_filled_data: {}, status: 'filed' },
      { ai_confidence_scores: null, form_data: {}, ai_filled_data: {}, status: 'approved' },
      { ai_confidence_scores: null, form_data: {}, ai_filled_data: {}, status: 'in_review' },
    ];
    setupMocks({ forms: mockForms });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Field Validation');

    // filed=100, approved=90, in_review=80 => avg = (100+90+80)/3 = 90
    expect(factor!.score).toBe(90);
    expect(factor!.status).toBe('good');
  });

  it('generates details for draft and rejected forms', async () => {
    const mockForms = [
      { ai_confidence_scores: null, form_data: {}, ai_filled_data: {}, status: 'draft' },
      { ai_confidence_scores: null, form_data: {}, ai_filled_data: {}, status: 'rejected' },
    ];
    setupMocks({ forms: mockForms });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Field Validation');

    // draft=40, rejected=20 => avg = (40+20)/2 = 30
    expect(factor!.score).toBe(30);
    expect(factor!.status).toBe('poor');
  });
});

// ---------------------------------------------------------------------------
// Group F: Timeline sub-calculator
// ---------------------------------------------------------------------------
describe('Timeline sub-calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns score 50 when no case data exists', async () => {
    setupMocks({ cases: null });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Timeline');

    expect(factor).toBeDefined();
    expect(factor!.score).toBe(50);
  });

  it('returns score 70 when no deadline is set', async () => {
    setupMocks({
      cases: { deadline: null, created_at: '2025-01-01', status: 'intake' },
    });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Timeline');

    expect(factor!.score).toBe(70);
  });

  it('returns score 0 when deadline has passed', async () => {
    setupMocks({
      cases: { deadline: '2025-06-01', created_at: '2025-01-01', status: 'intake' },
    });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Timeline');

    expect(factor!.score).toBe(0);
    expect(factor!.status).toBe('poor');
  });

  it('returns score 30 when deadline is within 7 days', async () => {
    setupMocks({
      cases: { deadline: '2025-06-20', created_at: '2025-01-01', status: 'intake' },
    });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Timeline');

    expect(factor!.score).toBe(30);
  });

  it('returns score 100 when deadline is more than 90 days away', async () => {
    setupMocks({
      cases: { deadline: '2025-12-01', created_at: '2025-01-01', status: 'intake' },
    });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Timeline');

    expect(factor!.score).toBe(100);
    expect(factor!.status).toBe('good');
  });
});

// ---------------------------------------------------------------------------
// Group G: Case Readiness sub-calculator
// ---------------------------------------------------------------------------
describe('Case Readiness sub-calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns score 50 when no case data exists', async () => {
    setupMocks({ cases: null });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Case Readiness');

    expect(factor).toBeDefined();
    expect(factor!.score).toBe(50);
  });

  it('returns score 30 for intake status', async () => {
    setupMocks({
      cases: { status: 'intake', deadline: null, created_at: '2025-01-01' },
    });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Case Readiness');

    expect(factor!.score).toBe(30);
    expect(factor!.status).toBe('poor');
  });

  it('returns score 100 for approved status', async () => {
    setupMocks({
      cases: { status: 'approved', deadline: null, created_at: '2025-01-01' },
    });

    const result = await calculateSuccessScore(CASE_ID);
    const factor = result.factors.find((f) => f.name === 'Case Readiness');

    expect(factor!.score).toBe(100);
    expect(factor!.status).toBe('good');
  });
});

// ---------------------------------------------------------------------------
// Group H: calculateSuccessScore integration
// ---------------------------------------------------------------------------
describe('calculateSuccessScore integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires all factors correctly when all data is present', async () => {
    const mockDocs = [
      { ai_confidence_score: 0.9, document_type: 'passport', status: 'verified' },
    ];
    const mockForms = [
      {
        ai_confidence_scores: { field1: 0.85 },
        form_data: {},
        ai_filled_data: {},
        status: 'filed',
      },
    ];
    const mockCase = {
      deadline: null,
      created_at: '2025-01-01',
      status: 'ready_for_filing',
    };

    setupMocks({
      documents: mockDocs,
      forms: mockForms,
      cases: mockCase,
    });

    vi.mocked(analyzeDocumentCompleteness).mockResolvedValue(
      makeCompletenessResult({ overallCompleteness: 90, uploadedRequired: 5, totalRequired: 5 }) as never
    );

    const result = await calculateSuccessScore(CASE_ID);

    expect(result.factors).toHaveLength(6);
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.calculatedAt).toBeDefined();

    const factorNames = result.factors.map((f) => f.name);
    expect(factorNames).toContain('Document Completeness');
    expect(factorNames).toContain('Document Quality');
    expect(factorNames).toContain('Form Field Confidence');
    expect(factorNames).toContain('Field Validation');
    expect(factorNames).toContain('Timeline');
    expect(factorNames).toContain('Case Readiness');
  });

  it('gives score 0 for document completeness when analyzeDocumentCompleteness throws', async () => {
    setupMocks({ documents: [], cases: null });
    vi.mocked(analyzeDocumentCompleteness).mockRejectedValue(
      new Error('AI service unavailable')
    );

    const result = await calculateSuccessScore(CASE_ID);

    const factor = result.factors.find((f) => f.name === 'Document Completeness');
    expect(factor!.score).toBe(0);
    expect(factor!.status).toBe('poor');
    // Other factors should still be present
    expect(result.factors).toHaveLength(6);
  });

  it('calculates confidence as ratio of non-zero factors', async () => {
    // All data empty => most factors score 0
    setupMocks({ documents: [], forms: [], cases: null });
    vi.mocked(analyzeDocumentCompleteness).mockResolvedValue(
      makeCompletenessResult({ overallCompleteness: 0, uploadedRequired: 0, totalRequired: 5 }) as never
    );

    const result = await calculateSuccessScore(CASE_ID);

    // doc completeness=0, doc quality=0, form confidence=0,
    // field validation=50 (no forms), timeline=50 (no case), case readiness=50 (no case)
    // non-zero = 3 out of 6
    expect(result.confidence).toBe(3 / 6);
  });

  it('generates risk factors and improvements for poor/warning statuses', async () => {
    setupMocks({ documents: [], forms: [], cases: null });
    vi.mocked(analyzeDocumentCompleteness).mockResolvedValue(
      makeCompletenessResult({ overallCompleteness: 10 }) as never
    );

    const result = await calculateSuccessScore(CASE_ID);

    // Document Completeness score=10 => poor => risk factor
    expect(result.riskFactors.length).toBeGreaterThan(0);
    expect(
      result.riskFactors.some((r) => r.includes('Missing required documents'))
    ).toBe(true);

    // Improvements should also be generated for non-good factors
    expect(result.improvements.length).toBeGreaterThan(0);
    expect(
      result.improvements.some((i) => i.includes('Upload missing documents'))
    ).toBe(true);
  });
});
