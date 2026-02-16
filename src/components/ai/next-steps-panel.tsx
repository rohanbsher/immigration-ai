'use client';

import { cn } from '@/lib/utils';
import {
  useRecommendations,
  useUpdateRecommendation,
  getPriorityColors,
} from '@/hooks/use-recommendations';
import { AIContentBox, AILoading, AIBadge } from '@/components/ai';
import {
  FileText,
  ClipboardList,
  Clock,
  Eye,
  Lightbulb,
  Check,
  X,
  RefreshCw,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import type { Recommendation } from '@/lib/db/recommendations';

interface NextStepsPanelProps {
  caseId: string;
  variant?: 'full' | 'compact' | 'mini';
  maxItems?: number;
  showRefresh?: boolean;
  className?: string;
}

/**
 * Next Steps Panel - AI-generated recommendations for case actions.
 */
export function NextStepsPanel({
  caseId,
  variant = 'full',
  maxItems = 5,
  showRefresh = true,
  className,
}: NextStepsPanelProps) {
  const { data, isLoading, error, refetch, forceRefresh } = useRecommendations(caseId);
  const { completeRecommendation, dismissRecommendation, isUpdating } =
    useUpdateRecommendation(caseId);

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <AILoading message="Analyzing case" variant="minimal" />
      </div>
    );
  }

  // Show empty state for errors or degraded results
  const isDegraded = error || (data as (typeof data) & { degraded?: boolean })?.degraded;

  if (isDegraded || !data || data.recommendations.length === 0) {
    return (
      <EmptyState caseId={caseId} onRefresh={refetch} className={className} />
    );
  }

  const displayRecs = data.recommendations.slice(0, maxItems);

  // Mini variant - just shows count badge
  if (variant === 'mini') {
    const highPriority = data.recommendations.filter(
      (r) => r.priority === 'high'
    ).length;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/dashboard/cases/${caseId}#recommendations`}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                highPriority > 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-purple-100 text-purple-700',
                className
              )}
            >
              <Lightbulb size={12} />
              {data.recommendations.length}
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {data.recommendations.length} recommended action(s)
              {highPriority > 0 && ` (${highPriority} high priority)`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Lightbulb size={14} className="text-purple-500" />
            Next Steps
          </h4>
          {showRefresh && (
            <button
              onClick={() => forceRefresh()}
              className="text-slate-400 hover:text-slate-600"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
        <ul className="space-y-1">
          {displayRecs.map((rec) => (
            <CompactRecommendationItem
              key={rec.id}
              recommendation={rec}
              onComplete={() => completeRecommendation(rec.id)}
            />
          ))}
        </ul>
        {data.recommendations.length > maxItems && (
          <Link
            href={`/dashboard/cases/${caseId}#recommendations`}
            className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            View all {data.recommendations.length} recommendations
            <ChevronRight size={12} />
          </Link>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <AIContentBox
      title="Recommended Next Steps"
      variant="bordered"
      className={className}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AIBadge size="sm" label="AI" showTooltip tooltipText="AI-generated recommendations" />
          {data.source === 'cache' && (
            <span className="text-xs text-slate-400">
              Updated {formatTimeAgo(data.generatedAt)}
            </span>
          )}
        </div>
        {showRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => forceRefresh()}
            className="h-7 px-2 text-xs"
          >
            <RefreshCw size={12} className="mr-1" />
            Refresh
          </Button>
        )}
      </div>

      {/* Recommendations list */}
      <ul className="space-y-3">
        {displayRecs.map((rec) => (
          <RecommendationItem
            key={rec.id}
            recommendation={rec}
            onComplete={() => completeRecommendation(rec.id)}
            onDismiss={() => dismissRecommendation(rec.id)}
            isUpdating={isUpdating}
          />
        ))}
      </ul>

      {/* View more link */}
      {data.recommendations.length > maxItems && (
        <div className="mt-4 pt-4 border-t border-purple-100">
          <Link
            href={`/dashboard/cases/${caseId}#recommendations`}
            className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            View all {data.recommendations.length} recommendations
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </AIContentBox>
  );
}

/**
 * Individual recommendation item.
 */
function RecommendationItem({
  recommendation,
  onComplete,
  onDismiss,
  isUpdating,
}: {
  recommendation: Recommendation;
  onComplete: () => void;
  onDismiss: () => void;
  isUpdating: boolean;
}) {
  const colors = getPriorityColors(recommendation.priority);

  return (
    <li
      className={cn(
        'p-3 rounded-lg border',
        colors.bg,
        colors.border
      )}
    >
      <div className="flex items-start gap-3">
        {/* Priority indicator */}
        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', colors.dot)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CategoryIcon category={recommendation.category} size={14} className={colors.text} />
            <span className={cn('text-sm font-medium', colors.text)}>
              {recommendation.action}
            </span>
          </div>
          <p className="text-xs text-slate-500">{recommendation.reason}</p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            {recommendation.actionUrl && (
              <Link
                href={recommendation.actionUrl}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                Go to action
                <ChevronRight size={12} />
              </Link>
            )}
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onComplete}
              disabled={isUpdating}
              className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <Check size={12} className="mr-1" />
              Done
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              disabled={isUpdating}
              className="h-6 px-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            >
              <X size={12} className="mr-1" />
              Skip
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Compact recommendation item.
 */
function CompactRecommendationItem({
  recommendation,
  onComplete,
}: {
  recommendation: Recommendation;
  onComplete: () => void;
}) {
  const colors = getPriorityColors(recommendation.priority);

  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', colors.dot)} />
      <span className="flex-1 truncate text-slate-700">{recommendation.action}</span>
      <button
        onClick={onComplete}
        className="text-green-500 hover:text-green-600"
      >
        <Check size={14} />
      </button>
    </li>
  );
}

/**
 * Empty state component.
 */
function EmptyState({
  onRefresh,
  className,
}: {
  caseId: string;
  onRefresh: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'p-6 text-center border border-dashed border-purple-200 rounded-lg bg-purple-50/30',
        className
      )}
    >
      <Lightbulb size={32} className="mx-auto text-purple-300 mb-3" />
      <h4 className="text-sm font-medium text-slate-700 mb-1">
        No recommendations yet
      </h4>
      <p className="text-xs text-slate-500 mb-4">
        Upload documents or add forms to get AI-powered suggestions.
      </p>
      <Button variant="outline" size="sm" onClick={onRefresh}>
        <RefreshCw size={12} className="mr-1" />
        Check again
      </Button>
    </div>
  );
}

/**
 * Icon component for category.
 */
function CategoryIcon({
  category,
  size,
  className,
}: {
  category: Recommendation['category'];
  size: number;
  className?: string;
}) {
  switch (category) {
    case 'document':
      return <FileText size={size} className={className} />;
    case 'form':
      return <ClipboardList size={size} className={className} />;
    case 'deadline':
      return <Clock size={size} className={className} />;
    case 'review':
      return <Eye size={size} className={className} />;
    default:
      return <Lightbulb size={size} className={className} />;
  }
}

/**
 * Format time ago string.
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export { RecommendationItem, CompactRecommendationItem };
