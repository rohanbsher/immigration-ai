'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import type { SearchResponse, SearchResult } from '@/lib/ai/natural-search';

/**
 * Perform natural language search.
 */
async function performSearch(query: string): Promise<SearchResponse> {
  const response = await fetchWithTimeout('/api/cases/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    timeout: 'AI',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to perform search');
  }

  return response.json();
}

/**
 * React Query mutation hook for natural language search.
 *
 * @returns Mutation handlers and state
 *
 * @example
 * ```tsx
 * const { search, data, isSearching, error } = useNaturalSearch();
 *
 * const handleSearch = (query: string) => {
 *   search(query);
 * };
 *
 * return (
 *   <div>
 *     <input onSubmit={(e) => handleSearch(e.target.value)} />
 *     {isSearching && <AILoading />}
 *     {data && <SearchResults results={data.results} />}
 *   </div>
 * );
 * ```
 */
export function useNaturalSearch() {
  const queryClient = useQueryClient();

  const mutation = useMutation<SearchResponse, Error, string>({
    mutationFn: performSearch,
    onSuccess: (data, query) => {
      // Cache the results
      queryClient.setQueryData(['search', query], data);
    },
  });

  return {
    search: mutation.mutate,
    searchAsync: mutation.mutateAsync,
    data: mutation.data,
    isSearching: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Get confidence color based on score.
 */
export function getConfidenceColor(confidence: number): {
  bg: string;
  text: string;
  label: string;
} {
  if (confidence >= 0.8) {
    return { bg: 'bg-green-100', text: 'text-green-700', label: 'High confidence' };
  }
  if (confidence >= 0.5) {
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium confidence' };
  }
  return { bg: 'bg-red-100', text: 'text-red-700', label: 'Low confidence' };
}

/**
 * Get relevance indicator.
 */
export function getRelevanceIndicator(score: number): {
  dots: number;
  label: string;
} {
  if (score >= 0.9) return { dots: 3, label: 'Highly relevant' };
  if (score >= 0.7) return { dots: 2, label: 'Relevant' };
  return { dots: 1, label: 'Somewhat relevant' };
}

/**
 * Format filter for display.
 */
export function formatFilterValue(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    // Handle date range
    const dateRange = value as { start?: string; end?: string };
    if (dateRange.start && dateRange.end) {
      return `${dateRange.start} to ${dateRange.end}`;
    }
    if (dateRange.start) return `after ${dateRange.start}`;
    if (dateRange.end) return `before ${dateRange.end}`;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

/**
 * Get filter display name.
 */
export function getFilterDisplayName(key: string): string {
  const names: Record<string, string> = {
    visaType: 'Visa Type',
    status: 'Status',
    dateRange: 'Date Range',
    documentMissing: 'Missing Documents',
    documentPresent: 'Has Documents',
    clientName: 'Client Name',
    priority: 'Priority',
    hasDeadline: 'Has Deadline',
    textSearch: 'Text Search',
  };
  return names[key] || key;
}
