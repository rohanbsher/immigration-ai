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
vi.mock('@/lib/api/parse-response', () => ({
  parseApiResponse: (...args: unknown[]) => mockParseApiResponse(...args),
}));

import {
  useNaturalSearch,
  getConfidenceColor,
  getRelevanceIndicator,
  formatFilterValue,
  getFilterDisplayName,
} from './use-natural-search';

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

const mockSearchResponse = {
  results: [
    {
      id: 'case-1',
      title: 'H-1B Application',
      relevanceScore: 0.95,
      matchedFields: ['title', 'description'],
    },
  ],
  totalResults: 1,
  query: 'H-1B applications',
  confidence: 0.9,
  filters: {},
};

describe('useNaturalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('performs search mutation', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSearchResponse);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNaturalSearch(), {
      wrapper: Wrapper,
    });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.data).toBeUndefined();

    act(() => {
      result.current.search('H-1B applications');
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
      expect(result.current.data).toEqual(mockSearchResponse);
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/cases/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'H-1B applications' }),
      timeout: 'AI',
    });
  });

  test('caches search results in queryClient', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSearchResponse);

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useNaturalSearch(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.searchAsync('H-1B applications');
    });

    const cachedData = queryClient.getQueryData(['search', 'H-1B applications']);
    expect(cachedData).toEqual(mockSearchResponse);
  });

  test('handles search error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false, status: 500 });
    mockParseApiResponse.mockRejectedValue(new Error('AI service unavailable'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNaturalSearch(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.search('failing query');
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    expect(result.current.error?.message).toBe('AI service unavailable');
  });

  test('reset clears search data and error', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue(mockSearchResponse);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useNaturalSearch(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.search('test query');
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockSearchResponse);
    });

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.data).toBeUndefined();
    });
    expect(result.current.error).toBeNull();
  });
});

describe('getConfidenceColor', () => {
  test('returns green colors for high confidence (>= 0.8)', () => {
    const colors = getConfidenceColor(0.8);
    expect(colors.bg).toBe('bg-green-100');
    expect(colors.text).toBe('text-green-700');
    expect(colors.label).toBe('High confidence');
  });

  test('returns green colors for very high confidence', () => {
    const colors = getConfidenceColor(0.95);
    expect(colors.label).toBe('High confidence');
  });

  test('returns yellow colors for medium confidence (>= 0.5 and < 0.8)', () => {
    const colors = getConfidenceColor(0.5);
    expect(colors.bg).toBe('bg-yellow-100');
    expect(colors.text).toBe('text-yellow-700');
    expect(colors.label).toBe('Medium confidence');
  });

  test('returns red colors for low confidence (< 0.5)', () => {
    const colors = getConfidenceColor(0.3);
    expect(colors.bg).toBe('bg-red-100');
    expect(colors.text).toBe('text-red-700');
    expect(colors.label).toBe('Low confidence');
  });
});

describe('getRelevanceIndicator', () => {
  test('returns 3 dots for highly relevant (>= 0.9)', () => {
    const indicator = getRelevanceIndicator(0.9);
    expect(indicator.dots).toBe(3);
    expect(indicator.label).toBe('Highly relevant');
  });

  test('returns 2 dots for relevant (>= 0.7 and < 0.9)', () => {
    const indicator = getRelevanceIndicator(0.7);
    expect(indicator.dots).toBe(2);
    expect(indicator.label).toBe('Relevant');
  });

  test('returns 1 dot for somewhat relevant (< 0.7)', () => {
    const indicator = getRelevanceIndicator(0.5);
    expect(indicator.dots).toBe(1);
    expect(indicator.label).toBe('Somewhat relevant');
  });
});

describe('formatFilterValue', () => {
  test('formats array values as comma-separated string', () => {
    expect(formatFilterValue('status', ['intake', 'in_progress'])).toBe('intake, in_progress');
  });

  test('formats date range with start and end', () => {
    expect(formatFilterValue('dateRange', { start: '2026-01-01', end: '2026-12-31' })).toBe('2026-01-01 to 2026-12-31');
  });

  test('formats date range with only start', () => {
    expect(formatFilterValue('dateRange', { start: '2026-01-01' })).toBe('after 2026-01-01');
  });

  test('formats date range with only end', () => {
    expect(formatFilterValue('dateRange', { end: '2026-12-31' })).toBe('before 2026-12-31');
  });

  test('formats boolean true as Yes', () => {
    expect(formatFilterValue('hasDeadline', true)).toBe('Yes');
  });

  test('formats boolean false as No', () => {
    expect(formatFilterValue('hasDeadline', false)).toBe('No');
  });

  test('formats string values directly', () => {
    expect(formatFilterValue('status', 'intake')).toBe('intake');
  });

  test('formats number values as string', () => {
    expect(formatFilterValue('priority', 5)).toBe('5');
  });
});

describe('getFilterDisplayName', () => {
  test('returns display name for known filter keys', () => {
    expect(getFilterDisplayName('visaType')).toBe('Visa Type');
    expect(getFilterDisplayName('status')).toBe('Status');
    expect(getFilterDisplayName('dateRange')).toBe('Date Range');
    expect(getFilterDisplayName('documentMissing')).toBe('Missing Documents');
    expect(getFilterDisplayName('documentPresent')).toBe('Has Documents');
    expect(getFilterDisplayName('clientName')).toBe('Client Name');
    expect(getFilterDisplayName('priority')).toBe('Priority');
    expect(getFilterDisplayName('hasDeadline')).toBe('Has Deadline');
    expect(getFilterDisplayName('textSearch')).toBe('Text Search');
  });

  test('returns key as fallback for unknown filter keys', () => {
    expect(getFilterDisplayName('unknownFilter')).toBe('unknownFilter');
  });
});
