'use client';

import { cn } from '@/lib/utils';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNaturalSearch } from '@/hooks/use-natural-search';
import { AILoading } from '@/components/ai';
import {
  Search,
  Sparkles,
  X,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AISearchInputProps {
  placeholder?: string;
  className?: string;
  onResultsChange?: (results: unknown[] | null) => void;
  showToggle?: boolean;
  defaultAIMode?: boolean;
}

/**
 * AI Search Input - Enhanced search with natural language support.
 */
export function AISearchInput({
  placeholder = 'Search cases...',
  className,
  onResultsChange,
  showToggle = true,
  defaultAIMode = true,
}: AISearchInputProps) {
  const [query, setQuery] = useState('');
  const [isAIMode, setIsAIMode] = useState(defaultAIMode);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('recentSearches');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { search, data, isSearching, error, reset } = useNaturalSearch();

  // Notify parent of results
  useEffect(() => {
    if (onResultsChange) {
      onResultsChange(data?.results || null);
    }
  }, [data, onResultsChange]);

  const handleSearch = useCallback(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) return;

    if (isAIMode) {
      search(trimmedQuery);
    }

    // Save to recent searches
    const newRecent = [
      trimmedQuery,
      ...recentSearches.filter((s) => s !== trimmedQuery),
    ].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('recentSearches', JSON.stringify(newRecent));

    setShowSuggestions(false);
  }, [query, isAIMode, search, recentSearches]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    [handleSearch]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    reset();
    onResultsChange?.(null);
    inputRef.current?.focus();
  }, [reset, onResultsChange]);

  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
      setShowSuggestions(false);
      setTimeout(() => {
        search(suggestion);
      }, 0);
    },
    [search]
  );

  return (
    <div className={cn('relative', className)}>
      {/* Input container */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
          isAIMode
            ? 'border-purple-300 bg-purple-50/50 focus-within:border-purple-400'
            : 'border-slate-200 bg-white focus-within:border-slate-400'
        )}
      >
        {/* Icon */}
        {isAIMode ? (
          <Sparkles size={18} className="text-purple-500 flex-shrink-0" />
        ) : (
          <Search size={18} className="text-slate-400 flex-shrink-0" />
        )}

        {/* Input */}
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={isAIMode ? 'Try "H1B cases with missing I-94"' : placeholder}
          className="flex-1 border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}

        {/* AI toggle */}
        {showToggle && (
          <button
            onClick={() => setIsAIMode(!isAIMode)}
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium transition-colors',
              isAIMode
                ? 'bg-purple-100 text-purple-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {isAIMode ? 'AI' : 'Exact'}
          </button>
        )}

        {/* Search button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSearch}
          disabled={isSearching || query.length < 2}
          className="h-7 px-2"
        >
          {isSearching ? (
            <AILoading variant="inline" size="sm" message="" />
          ) : (
            <ArrowRight size={16} />
          )}
        </Button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && !isSearching && (
        <SuggestionsDropdown
          recentSearches={recentSearches}
          aiSuggestions={data?.suggestions || []}
          interpretation={data?.interpretation}
          onSelect={handleSelectSuggestion}
          onClose={() => setShowSuggestions(false)}
        />
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error.message}</p>
      )}
    </div>
  );
}

/**
 * Suggestions dropdown.
 */
function SuggestionsDropdown({
  recentSearches,
  aiSuggestions,
  interpretation,
  onSelect,
  onClose,
}: {
  recentSearches: string[];
  aiSuggestions: string[];
  interpretation?: { understood: string; confidence: number };
  onSelect: (query: string) => void;
  onClose: () => void;
}) {
  if (!recentSearches.length && !aiSuggestions.length && !interpretation) {
    return null;
  }

  return (
    <div
      className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg z-50"
      onMouseLeave={onClose}
    >
      {/* Interpretation */}
      {interpretation && (
        <div className="px-3 py-2 border-b border-slate-100 bg-purple-50/50">
          <div className="flex items-center gap-2 text-xs text-purple-600">
            <Sparkles size={12} />
            <span>Understood: {interpretation.understood}</span>
            <span className="text-purple-400">
              ({Math.round(interpretation.confidence * 100)}% confident)
            </span>
          </div>
        </div>
      )}

      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <div className="p-2">
          <p className="px-2 py-1 text-xs font-medium text-slate-500">Recent</p>
          {recentSearches.map((search, i) => (
            <button
              key={i}
              onClick={() => onSelect(search)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 rounded"
            >
              <Clock size={12} className="text-slate-400" />
              {search}
            </button>
          ))}
        </div>
      )}

      {/* AI suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="p-2 border-t border-slate-100">
          <p className="px-2 py-1 text-xs font-medium text-purple-600 flex items-center gap-1">
            <Sparkles size={10} />
            Suggestions
          </p>
          {aiSuggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => onSelect(suggestion)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 hover:bg-purple-50 rounded"
            >
              <ArrowRight size={12} className="text-purple-400" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact AI search badge for headers.
 */
export function AISearchBadge({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700',
        'transition-colors text-sm',
        className
      )}
    >
      <Search size={14} />
      <span>Search</span>
      <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-600">
        AI
      </span>
    </button>
  );
}
