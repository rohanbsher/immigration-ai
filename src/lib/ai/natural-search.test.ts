import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup environment
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------
const { mockCallClaudeStructured, featuresMock } = vi.hoisted(() => {
  const mockCallClaudeStructured = vi.fn();
  const featuresMock = {
    formAutofill: true,
    documentAnalysis: true,
    documentAnalysisProvider: 'auto' as const,
  };
  return { mockCallClaudeStructured, featuresMock };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

vi.mock('@/lib/config', () => ({
  features: featuresMock,
  env: { NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key' },
  serverEnv: { ANTHROPIC_API_KEY: 'test-key' },
}));

vi.mock('./structured-output', () => ({
  callClaudeStructured: (...args: unknown[]) => mockCallClaudeStructured(...args),
}));

vi.mock('@/lib/db/search-utils', () => ({
  sanitizeSearchInput: (input: string) => input.replace(/[%_]/g, '').trim(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import {
  parseSearchQuery,
  executeSearch,
  generateSuggestions,
  naturalLanguageSearch,
} from './natural-search';
import type { SearchInterpretation, SearchFilters } from './natural-search';

// ---------------------------------------------------------------------------
// parseSearchQuery
// ---------------------------------------------------------------------------
describe('parseSearchQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featuresMock.formAutofill = true;
  });

  it('returns "All cases" for empty query', async () => {
    const result = await parseSearchQuery('');
    expect(result.understood).toBe('All cases');
    expect(result.filters).toEqual({});
    expect(result.confidence).toBe(1.0);
  });

  it('returns "All cases" for single-character query', async () => {
    const result = await parseSearchQuery('a');
    expect(result.understood).toBe('All cases');
    expect(result.confidence).toBe(1.0);
  });

  it('returns "All cases" for whitespace-only query', async () => {
    const result = await parseSearchQuery(' ');
    expect(result.understood).toBe('All cases');
    expect(result.confidence).toBe(1.0);
  });

  it('falls back to text search when Anthropic is not configured', async () => {
    featuresMock.formAutofill = false;

    const result = await parseSearchQuery('H-1B cases pending');
    expect(result.understood).toBe('Search for "H-1B cases pending"');
    expect(result.filters.textSearch).toBe('H-1B cases pending');
    expect(result.confidence).toBe(0.3);
  });

  it('calls Claude structured output for normal queries', async () => {
    mockCallClaudeStructured.mockResolvedValue({
      understood: 'H-1B cases that are pending',
      filters: {
        visaType: ['H1B'],
        status: ['pending_response'],
      },
      sortBy: 'relevance',
      confidence: 0.9,
    });

    const result = await parseSearchQuery('H-1B cases pending');
    expect(mockCallClaudeStructured).toHaveBeenCalledTimes(1);
    expect(result.understood).toBe('H-1B cases that are pending');
    expect(result.filters.visaType).toEqual(['H1B']);
    expect(result.filters.status).toEqual(['pending_response']);
    expect(result.sortBy).toBe('relevance');
    expect(result.confidence).toBe(0.9);
  });

  it('handles missing optional fields in Claude response', async () => {
    mockCallClaudeStructured.mockResolvedValue({
      understood: undefined,
      filters: undefined,
      confidence: undefined,
    });

    const result = await parseSearchQuery('find cases');
    expect(result.understood).toBe('find cases');
    expect(result.filters).toEqual({});
    expect(result.confidence).toBe(0.5);
  });

  it('falls back to text search on Claude error', async () => {
    mockCallClaudeStructured.mockRejectedValue(new Error('API rate limited'));

    const result = await parseSearchQuery('some search query');
    expect(result.understood).toBe('Search for "some search query"');
    expect(result.filters.textSearch).toBe('some search query');
    expect(result.confidence).toBe(0.3);
  });

  it('passes today date in user message to Claude', async () => {
    mockCallClaudeStructured.mockResolvedValue({
      understood: 'Cases with deadlines',
      filters: { hasDeadline: true },
      confidence: 0.8,
    });

    await parseSearchQuery('cases with upcoming deadlines');

    const callArgs = mockCallClaudeStructured.mock.calls[0][0];
    expect(callArgs.userMessage).toContain('Today\'s date is');
  });
});

// ---------------------------------------------------------------------------
// executeSearch
// ---------------------------------------------------------------------------
describe('executeSearch', () => {
  const userId = 'user-123';

  function createMockSupabase(queryData: unknown[] | null, error: unknown = null) {
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: queryData, error }),
    };

    return {
      from: vi.fn().mockReturnValue(chainMock),
      _chain: chainMock,
    } as unknown as import('@supabase/supabase-js').SupabaseClient;
  }

  it('returns results for basic query', async () => {
    const mockCases = [
      {
        id: 'case-1',
        title: 'H-1B Petition',
        visa_type: 'H1B',
        status: 'filed',
        deadline: '2026-06-01',
        created_at: '2026-01-01',
        client: [{ first_name: 'John', last_name: 'Doe' }],
      },
    ];

    const supabase = createMockSupabase(mockCases);
    const filters: SearchFilters = { visaType: ['H1B'] };

    const results = await executeSearch(filters, userId, supabase);

    expect(results).toHaveLength(1);
    expect(results[0].case.id).toBe('case-1');
    expect(results[0].case.visaType).toBe('H1B');
    expect(results[0].case.clientName).toBe('John Doe');
  });

  it('returns empty array when no cases match', async () => {
    const supabase = createMockSupabase([]);
    const results = await executeSearch({}, userId, supabase);
    expect(results).toEqual([]);
  });

  it('returns empty array when cases is null', async () => {
    const supabase = createMockSupabase(null);
    const results = await executeSearch({}, userId, supabase);
    expect(results).toEqual([]);
  });

  it('throws error on database error', async () => {
    const supabase = createMockSupabase(null, { message: 'DB error' });
    await expect(
      executeSearch({}, userId, supabase)
    ).rejects.toThrow('Failed to execute search');
  });

  it('handles unknown client name when client data is missing', async () => {
    const mockCases = [
      {
        id: 'case-1',
        title: 'Test Case',
        visa_type: 'H1B',
        status: 'filed',
        deadline: null,
        created_at: '2026-01-01',
        client: null,
      },
    ];

    const supabase = createMockSupabase(mockCases);
    const results = await executeSearch({}, userId, supabase);

    expect(results[0].case.clientName).toBe('Unknown');
  });

  it('handles empty client array', async () => {
    const mockCases = [
      {
        id: 'case-1',
        title: 'Test Case',
        visa_type: 'H1B',
        status: 'filed',
        deadline: null,
        created_at: '2026-01-01',
        client: [],
      },
    ];

    const supabase = createMockSupabase(mockCases);
    const results = await executeSearch({}, userId, supabase);

    expect(results[0].case.clientName).toBe('Unknown');
  });

  it('applies status filter', async () => {
    const supabase = createMockSupabase([]);
    const filters: SearchFilters = { status: ['filed', 'approved'] };

    await executeSearch(filters, userId, supabase);

    // The 'in' method should have been called for status filtering
    const chain = (supabase as unknown as { _chain: { in: ReturnType<typeof vi.fn> } })._chain;
    expect(chain.in).toHaveBeenCalledWith('status', ['filed', 'approved']);
  });

  it('applies date range filter', async () => {
    const supabase = createMockSupabase([]);
    const filters: SearchFilters = {
      dateRange: {
        start: '2026-01-01',
        end: '2026-12-31',
        field: 'created_at',
      },
    };

    await executeSearch(filters, userId, supabase);

    const chain = (supabase as unknown as { _chain: { gte: ReturnType<typeof vi.fn>; lte: ReturnType<typeof vi.fn> } })._chain;
    expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-01-01');
    expect(chain.lte).toHaveBeenCalledWith('created_at', '2026-12-31');
  });

  it('applies hasDeadline filter (true)', async () => {
    const supabase = createMockSupabase([]);
    const filters: SearchFilters = { hasDeadline: true };

    await executeSearch(filters, userId, supabase);

    const chain = (supabase as unknown as { _chain: { not: ReturnType<typeof vi.fn> } })._chain;
    expect(chain.not).toHaveBeenCalledWith('deadline', 'is', null);
  });

  it('applies hasDeadline filter (false)', async () => {
    const supabase = createMockSupabase([]);
    const filters: SearchFilters = { hasDeadline: false };

    await executeSearch(filters, userId, supabase);

    const chain = (supabase as unknown as { _chain: { is: ReturnType<typeof vi.fn> } })._chain;
    // is is called multiple times (once for deleted_at and once for deadline)
    expect(chain.is).toHaveBeenCalledWith('deadline', null);
  });

  it('applies text search filter', async () => {
    const supabase = createMockSupabase([]);
    const filters: SearchFilters = { textSearch: 'visa petition' };

    await executeSearch(filters, userId, supabase);

    const chain = (supabase as unknown as { _chain: { or: ReturnType<typeof vi.fn> } })._chain;
    // The or call should contain ilike patterns for the text search
    const orCalls = chain.or.mock.calls;
    const hasTextSearch = orCalls.some(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('ilike')
    );
    expect(hasTextSearch).toBe(true);
  });

  it('filters by client name', async () => {
    const mockCases = [
      {
        id: 'case-1',
        title: 'Case A',
        visa_type: 'H1B',
        status: 'filed',
        deadline: null,
        created_at: '2026-01-01',
        client: [{ first_name: 'John', last_name: 'Doe' }],
      },
      {
        id: 'case-2',
        title: 'Case B',
        visa_type: 'F1',
        status: 'filed',
        deadline: null,
        created_at: '2026-01-02',
        client: [{ first_name: 'Jane', last_name: 'Smith' }],
      },
    ];

    const supabase = createMockSupabase(mockCases);
    const filters: SearchFilters = { clientName: 'Jane' };

    const results = await executeSearch(filters, userId, supabase);

    expect(results).toHaveLength(1);
    expect(results[0].case.clientName).toBe('Jane Smith');
  });
});

// ---------------------------------------------------------------------------
// generateSuggestions
// ---------------------------------------------------------------------------
describe('generateSuggestions', () => {
  it('suggests broader search terms when no results', () => {
    const interpretation: SearchInterpretation = {
      understood: 'H-1B cases',
      filters: { visaType: ['H1B'] },
      confidence: 0.9,
    };

    const suggestions = generateSuggestions('H-1B cases', interpretation, 0);

    expect(suggestions).toContain('Try broader search terms');
    expect(suggestions).toContain('Remove visa type filter');
  });

  it('suggests removing status filter when no results', () => {
    const interpretation: SearchInterpretation = {
      understood: 'Filed cases',
      filters: { status: ['filed'] },
      confidence: 0.9,
    };

    const suggestions = generateSuggestions('filed cases', interpretation, 0);

    expect(suggestions).toContain('Include more case statuses');
  });

  it('suggests being more specific when low confidence', () => {
    const interpretation: SearchInterpretation = {
      understood: 'some query',
      filters: {},
      confidence: 0.5,
    };

    const suggestions = generateSuggestions('some query', interpretation, 5);

    expect(suggestions).toContain('Be more specific with your query');
  });

  it('suggests related H-4 cases for H1B queries', () => {
    const interpretation: SearchInterpretation = {
      understood: 'H-1B cases',
      filters: { visaType: ['H1B'] },
      confidence: 0.9,
    };

    const suggestions = generateSuggestions('H-1B cases', interpretation, 5);

    expect(suggestions).toContain('Related: H-4 dependent cases');
  });

  it('suggests expiring documents for missing document queries', () => {
    const interpretation: SearchInterpretation = {
      understood: 'Cases missing passport',
      filters: { documentMissing: ['passport'] },
      confidence: 0.8,
    };

    const suggestions = generateSuggestions(
      'cases missing passport',
      interpretation,
      3
    );

    expect(suggestions).toContain('Related: cases with expiring documents');
  });

  it('limits suggestions to 3', () => {
    const interpretation: SearchInterpretation = {
      understood: 'H-1B',
      filters: {
        visaType: ['H1B'],
        status: ['filed'],
        documentMissing: ['passport'],
      },
      confidence: 0.5,
    };

    const suggestions = generateSuggestions('H-1B', interpretation, 0);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('returns empty suggestions for good results with high confidence', () => {
    const interpretation: SearchInterpretation = {
      understood: 'All cases',
      filters: {},
      confidence: 0.95,
    };

    const suggestions = generateSuggestions('all', interpretation, 10);
    expect(suggestions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// naturalLanguageSearch (integration)
// ---------------------------------------------------------------------------
describe('naturalLanguageSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featuresMock.formAutofill = true;
  });

  it('combines parsing, execution, and suggestions', async () => {
    mockCallClaudeStructured.mockResolvedValue({
      understood: 'All H-1B cases',
      filters: { visaType: ['H1B'] },
      confidence: 0.9,
    });

    const mockCases = [
      {
        id: 'case-1',
        title: 'H-1B Case',
        visa_type: 'H1B',
        status: 'filed',
        deadline: null,
        created_at: '2026-01-01',
        client: [{ first_name: 'John', last_name: 'Doe' }],
      },
    ];

    const chainMock = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockCases, error: null }),
    };

    const supabase = {
      from: vi.fn().mockReturnValue(chainMock),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const response = await naturalLanguageSearch('H-1B cases', 'user-123', supabase);

    expect(response.interpretation.understood).toBe('All H-1B cases');
    expect(response.results).toHaveLength(1);
    expect(response.totalCount).toBe(1);
    expect(response.suggestions).toBeInstanceOf(Array);
  });

  it('handles empty search query', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const response = await naturalLanguageSearch('', 'user-123', supabase);

    expect(response.interpretation.understood).toBe('All cases');
    expect(response.interpretation.confidence).toBe(1.0);
  });

  it('falls back gracefully when Claude fails', async () => {
    mockCallClaudeStructured.mockRejectedValue(new Error('Service unavailable'));

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const response = await naturalLanguageSearch('test query', 'user-123', supabase);

    expect(response.interpretation.confidence).toBe(0.3);
    expect(response.interpretation.filters.textSearch).toBe('test query');
  });
});
