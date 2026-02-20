'use client';

import { cn } from '@/lib/utils';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNaturalSearch } from '@/hooks/use-natural-search';
import { logger } from '@/lib/logger';
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
import { SearchResults } from '@/components/search/search-results';

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
    } catch (error) {
      logger.warn('Failed to parse recent searches from localStorage', { error });
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
            ? 'border-ai-accent/40 bg-ai-accent-muted/50 focus-within:border-ai-accent/60'
            : 'border-border bg-background focus-within:border-border/80'
        )}
      >
        {/* Icon */}
        {isAIMode ? (
          <Sparkles size={18} className="text-ai-accent flex-shrink-0" />
        ) : (
          <Search size={18} className="text-muted-foreground flex-shrink-0" />
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
            className="text-muted-foreground hover:text-foreground"
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
                ? 'bg-ai-accent-muted text-ai-accent'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
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

      {/* Search Results */}
      {data && !showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-lg border border-border shadow-lg z-50 max-h-[400px] overflow-y-auto">
          <SearchResults response={data} />
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && !isSearching && !data && (
        <SuggestionsDropdown
          recentSearches={recentSearches}
          aiSuggestions={[]}
          interpretation={undefined}
          onSelect={handleSelectSuggestion}
          onClose={() => setShowSuggestions(false)}
        />
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-destructive">{error.message}</p>
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
      className="absolute top-full left-0 right-0 mt-1 bg-card rounded-lg border border-border shadow-lg z-50"
      onMouseLeave={onClose}
    >
      {/* Interpretation */}
      {interpretation && (
        <div className="px-3 py-2 border-b border-border/50 bg-ai-accent-muted/50">
          <div className="flex items-center gap-2 text-xs text-ai-accent">
            <Sparkles size={12} />
            <span>Understood: {interpretation.understood}</span>
            <span className="text-ai-accent/60">
              ({Math.round(interpretation.confidence * 100)}% confident)
            </span>
          </div>
        </div>
      )}

      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <div className="p-2">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Recent</p>
          {recentSearches.map((search, i) => (
            <button
              key={i}
              onClick={() => onSelect(search)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground hover:bg-muted/50 rounded"
            >
              <Clock size={12} className="text-muted-foreground" />
              {search}
            </button>
          ))}
        </div>
      )}

      {/* AI suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="p-2 border-t border-border/50">
          <p className="px-2 py-1 text-xs font-medium text-ai-accent flex items-center gap-1">
            <Sparkles size={10} />
            Suggestions
          </p>
          {aiSuggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => onSelect(suggestion)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-foreground hover:bg-ai-accent-muted/50 rounded"
            >
              <ArrowRight size={12} className="text-ai-accent/60" />
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
        'bg-muted hover:bg-ai-accent-muted/50 text-muted-foreground hover:text-ai-accent',
        'transition-colors text-sm',
        className
      )}
    >
      <Search size={14} />
      <span>Search</span>
      <span className="px-1.5 py-0.5 rounded text-xs bg-ai-accent-muted text-ai-accent">
        AI
      </span>
    </button>
  );
}
