import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchResults, SearchResultCard, InterpretationHeader, AppliedFilters } from './search-results';
import type { SearchResponse, SearchResult, SearchFilters } from '@/lib/ai/natural-search';

// Mock use-natural-search helpers
vi.mock('@/hooks/use-natural-search', () => ({
  getConfidenceColor: (confidence: number) => {
    if (confidence >= 0.8) return { bg: 'bg-green-100', text: 'text-green-700', label: 'High' };
    if (confidence >= 0.5) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' };
    return { bg: 'bg-red-100', text: 'text-red-700', label: 'Low' };
  },
  getFilterDisplayName: (key: string) => {
    const names: Record<string, string> = {
      visaType: 'Visa Type',
      status: 'Status',
      clientName: 'Client Name',
    };
    return names[key] || key;
  },
  formatFilterValue: (_key: string, value: unknown) => String(value),
}));

// Mock AIContentBox
vi.mock('@/components/ai', () => ({
  AIContentBox: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ai-content-box" className={className}>{children}</div>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

function makeResponse(overrides: Partial<SearchResponse> = {}): SearchResponse {
  return {
    interpretation: {
      understood: 'Search for H-1B cases',
      filters: {},
      confidence: 0.9,
    },
    results: [],
    totalCount: 0,
    suggestions: [],
    ...overrides,
  };
}

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    case: {
      id: 'case-1',
      title: 'H-1B Application for John',
      visaType: 'H1B',
      status: 'document_collection',
      clientName: 'John Smith',
      deadline: null,
      createdAt: '2025-01-01T00:00:00Z',
    },
    relevanceScore: 0.95,
    matchReason: 'Matches H-1B visa type filter',
    ...overrides,
  };
}

describe('SearchResults', () => {
  test('renders interpretation header', () => {
    const response = makeResponse({
      interpretation: {
        understood: 'Searching for pending H-1B cases',
        filters: {},
        confidence: 0.85,
      },
    });
    render(<SearchResults response={response} />);
    expect(screen.getByText('Searching for pending H-1B cases')).toBeInTheDocument();
  });

  test('renders confidence percentage', () => {
    const response = makeResponse({
      interpretation: {
        understood: 'Search',
        filters: {},
        confidence: 0.85,
      },
    });
    render(<SearchResults response={response} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  test('renders result count', () => {
    const response = makeResponse({
      results: [makeResult(), makeResult({ case: { ...makeResult().case, id: 'case-2' } })],
    });
    render(<SearchResults response={response} />);
    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  test('renders singular "result" for one result', () => {
    const response = makeResponse({ results: [makeResult()] });
    render(<SearchResults response={response} />);
    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  test('renders "No cases found" when no results', () => {
    const response = makeResponse({ results: [], suggestions: [] });
    render(<SearchResults response={response} />);
    expect(screen.getByText('No cases found')).toBeInTheDocument();
  });

  test('renders search suggestions when empty with suggestions', () => {
    const response = makeResponse({
      results: [],
      suggestions: ['Try H-1B cases', 'Search by client name'],
    });
    render(<SearchResults response={response} />);
    expect(screen.getByText('Suggestions:')).toBeInTheDocument();
    expect(screen.getByText('Try H-1B cases')).toBeInTheDocument();
  });

  test('renders "Related searches" when results and suggestions exist', () => {
    const response = makeResponse({
      results: [makeResult()],
      suggestions: ['More H-1B cases'],
    });
    render(<SearchResults response={response} />);
    expect(screen.getByText('Related searches:')).toBeInTheDocument();
    expect(screen.getByText('More H-1B cases')).toBeInTheDocument();
  });

  test('renders applied filters when present', () => {
    const response = makeResponse({
      interpretation: {
        understood: 'Search',
        filters: { visaType: ['H1B'] } as SearchFilters,
        confidence: 0.9,
      },
    });
    render(<SearchResults response={response} />);
    expect(screen.getByText('Filters:')).toBeInTheDocument();
    expect(screen.getByText(/Visa Type/)).toBeInTheDocument();
  });

  test('does not render filters section when no filters', () => {
    const response = makeResponse({
      interpretation: {
        understood: 'Search',
        filters: {},
        confidence: 0.9,
      },
    });
    render(<SearchResults response={response} />);
    expect(screen.queryByText('Filters:')).not.toBeInTheDocument();
  });

  test('renders search result cards with case data', () => {
    const response = makeResponse({
      results: [
        makeResult({
          case: {
            id: 'case-1',
            title: 'Immigration Case Alpha',
            visaType: 'H1B',
            status: 'intake',
            clientName: 'Alice Brown',
            deadline: null,
            createdAt: '2025-01-01T00:00:00Z',
          },
          matchReason: 'Matched by visa type',
        }),
      ],
    });
    render(<SearchResults response={response} />);
    expect(screen.getByText('Immigration Case Alpha')).toBeInTheDocument();
    expect(screen.getByText('Alice Brown')).toBeInTheDocument();
    expect(screen.getByText('Matched by visa type')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const response = makeResponse();
    const { container } = render(
      <SearchResults response={response} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('SearchResultCard', () => {
  test('renders case title', () => {
    render(<SearchResultCard result={makeResult()} />);
    expect(screen.getByText('H-1B Application for John')).toBeInTheDocument();
  });

  test('renders visa type', () => {
    render(<SearchResultCard result={makeResult()} />);
    expect(screen.getByText('H1B')).toBeInTheDocument();
  });

  test('renders client name', () => {
    render(<SearchResultCard result={makeResult()} />);
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  test('renders match reason', () => {
    render(<SearchResultCard result={makeResult()} />);
    expect(screen.getByText('Matches H-1B visa type filter')).toBeInTheDocument();
  });

  test('renders deadline when present', () => {
    const result = makeResult({
      case: {
        ...makeResult().case,
        deadline: '2025-06-01T00:00:00Z',
      },
    });
    render(<SearchResultCard result={result} />);
    // toLocaleDateString output varies by locale/TZ, just check there's a date-related text
    // The component renders: new Date(deadline).toLocaleDateString()
    const dateStr = new Date('2025-06-01T00:00:00Z').toLocaleDateString();
    expect(screen.getByText(dateStr)).toBeInTheDocument();
  });

  test('links to case detail page', () => {
    render(<SearchResultCard result={makeResult()} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard/cases/case-1');
  });
});

describe('InterpretationHeader', () => {
  test('renders understood text', () => {
    render(
      <InterpretationHeader
        interpretation={{ understood: 'My query', filters: {}, confidence: 0.9 }}
        resultCount={5}
      />
    );
    expect(screen.getByText('My query')).toBeInTheDocument();
  });

  test('renders result count', () => {
    render(
      <InterpretationHeader
        interpretation={{ understood: 'Query', filters: {}, confidence: 0.9 }}
        resultCount={3}
      />
    );
    expect(screen.getByText('3 results')).toBeInTheDocument();
  });
});

describe('AppliedFilters', () => {
  test('renders filter chips', () => {
    render(<AppliedFilters filters={{ visaType: ['H1B', 'L1'] } as SearchFilters} />);
    expect(screen.getByText('Filters:')).toBeInTheDocument();
  });

  test('returns null when no valid filters', () => {
    const { container } = render(<AppliedFilters filters={{} as SearchFilters} />);
    expect(container.innerHTML).toBe('');
  });
});
