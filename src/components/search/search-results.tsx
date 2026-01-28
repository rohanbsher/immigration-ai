'use client';

import { cn } from '@/lib/utils';
import {
  getConfidenceColor,
  getFilterDisplayName,
  formatFilterValue,
} from '@/hooks/use-natural-search';
import { AIContentBox, AIBadge } from '@/components/ai';
import {
  FileText,
  Calendar,
  User,
  Tag,
  ArrowRight,
  Info,
  Sparkles,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import type { SearchResponse, SearchResult, SearchFilters } from '@/lib/ai/natural-search';

interface SearchResultsProps {
  response: SearchResponse;
  className?: string;
}

/**
 * Search Results - Display natural language search results.
 */
export function SearchResults({ response, className }: SearchResultsProps) {
  const { interpretation, results, suggestions } = response;
  const confidenceInfo = getConfidenceColor(interpretation.confidence);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Interpretation header */}
      <InterpretationHeader
        interpretation={interpretation}
        resultCount={results.length}
      />

      {/* Applied filters */}
      {Object.keys(interpretation.filters).length > 0 && (
        <AppliedFilters filters={interpretation.filters} />
      )}

      {/* Results list */}
      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((result) => (
            <SearchResultCard key={result.case.id} result={result} />
          ))}
        </div>
      ) : (
        <EmptyResults suggestions={suggestions} />
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && results.length > 0 && (
        <SearchSuggestions suggestions={suggestions} />
      )}
    </div>
  );
}

/**
 * Interpretation header.
 */
function InterpretationHeader({
  interpretation,
  resultCount,
}: {
  interpretation: SearchResponse['interpretation'];
  resultCount: number;
}) {
  const confidenceInfo = getConfidenceColor(interpretation.confidence);

  return (
    <AIContentBox variant="subtle" className="py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-500" />
          <span className="text-sm text-slate-700">
            {interpretation.understood}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              confidenceInfo.bg,
              confidenceInfo.text
            )}
          >
            {Math.round(interpretation.confidence * 100)}%
          </span>
          <span className="text-sm text-slate-500">
            {resultCount} result{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </AIContentBox>
  );
}

/**
 * Applied filters chips.
 */
function AppliedFilters({ filters }: { filters: SearchFilters }) {
  const filterEntries = Object.entries(filters).filter(
    ([, value]) => value !== undefined && value !== null
  );

  if (filterEntries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs text-slate-500 flex items-center gap-1">
        <Tag size={12} />
        Filters:
      </span>
      {filterEntries.map(([key, value]) => (
        <span
          key={key}
          className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700"
        >
          {getFilterDisplayName(key)}: {formatFilterValue(key, value)}
        </span>
      ))}
    </div>
  );
}

/**
 * Individual search result card.
 */
function SearchResultCard({ result }: { result: SearchResult }) {
  const { case: caseData, matchReason } = result;

  return (
    <Link
      href={`/dashboard/cases/${caseData.id}`}
      className="block p-4 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className="text-sm font-medium text-slate-900 truncate">
            {caseData.title}
          </h4>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Tag size={10} />
              {caseData.visaType}
            </span>
            <span className="flex items-center gap-1">
              <User size={10} />
              {caseData.clientName}
            </span>
            <span className="flex items-center gap-1 capitalize">
              {caseData.status.replace('_', ' ')}
            </span>
            {caseData.deadline && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {new Date(caseData.deadline).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Match reason */}
          <p className="mt-2 text-xs text-purple-600 flex items-center gap-1">
            <Info size={10} />
            {matchReason}
          </p>
        </div>

        {/* Arrow */}
        <ArrowRight size={16} className="text-slate-400 flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}

/**
 * Empty results state.
 */
function EmptyResults({ suggestions }: { suggestions: string[] }) {
  return (
    <div className="p-8 text-center border border-dashed border-slate-200 rounded-lg">
      <Search size={32} className="mx-auto text-slate-300 mb-3" />
      <h4 className="text-sm font-medium text-slate-700 mb-1">
        No cases found
      </h4>
      <p className="text-xs text-slate-500 mb-4">
        Try adjusting your search or use different terms.
      </p>
      {suggestions.length > 0 && (
        <div className="text-xs text-slate-500">
          <span>Suggestions: </span>
          {suggestions.map((s, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Search suggestions footer.
 */
function SearchSuggestions({ suggestions }: { suggestions: string[] }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>Related searches:</span>
      {suggestions.map((suggestion, i) => (
        <span key={i} className="text-purple-600 hover:underline cursor-pointer">
          {suggestion}
        </span>
      ))}
    </div>
  );
}

export { SearchResultCard, InterpretationHeader, AppliedFilters };
