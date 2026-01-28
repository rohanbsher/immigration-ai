'use client';

import { cn } from '@/lib/utils';
import {
  useDeadlines,
  useUpdateDeadlineAlert,
  getSeverityColors,
  formatDaysRemaining,
  getAlertTypeLabel,
} from '@/hooks/use-deadlines';
import { AILoading, AIBadge } from '@/components/ai';
import {
  Calendar,
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  Bell,
  BellOff,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import type { DeadlineAlert } from '@/lib/deadline';

interface DeadlineWidgetProps {
  maxItems?: number;
  showHeader?: boolean;
  className?: string;
}

/**
 * Deadline Widget for Dashboard
 *
 * Displays upcoming deadlines with severity indicators.
 */
export function DeadlineWidget({
  maxItems = 5,
  showHeader = true,
  className,
}: DeadlineWidgetProps) {
  const { data, isLoading, error } = useDeadlines();
  const { acknowledgeAlert, snoozeAlert, isUpdating } = useUpdateDeadlineAlert();

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <AILoading message="Loading deadlines" variant="minimal" size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-red-600 flex items-center gap-2', className)}>
        <AlertCircle size={16} />
        <span className="text-sm">Failed to load deadlines</span>
      </div>
    );
  }

  if (!data || data.summary.total === 0) {
    return (
      <EmptyState className={className} />
    );
  }

  // Combine critical and warning, sorted by date
  const urgentDeadlines = [
    ...data.grouped.critical,
    ...data.grouped.warning,
  ].slice(0, maxItems);

  const hasMore = data.summary.total > maxItems;

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white', className)}>
      {/* Header */}
      {showHeader && (
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Calendar size={16} className="text-slate-500" />
              Upcoming Deadlines
            </h3>
            <SummaryBadges summary={data.summary} />
          </div>
        </div>
      )}

      {/* Deadline list */}
      <div className="divide-y divide-slate-100">
        {urgentDeadlines.map((deadline) => (
          <DeadlineItem
            key={deadline.id}
            deadline={deadline}
            onAcknowledge={() => acknowledgeAlert(deadline.id)}
            onSnooze={() => snoozeAlert(deadline.id)}
            isUpdating={isUpdating}
          />
        ))}
      </div>

      {/* Footer with view all link */}
      {hasMore && (
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
          <Link
            href="/dashboard?tab=deadlines"
            className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            View all {data.summary.total} deadlines
            <ChevronRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Summary badges showing counts by severity.
 */
function SummaryBadges({
  summary,
}: {
  summary: { critical: number; warning: number; info: number };
}) {
  return (
    <div className="flex items-center gap-1">
      {summary.critical > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <AlertCircle size={10} />
                {summary.critical}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{summary.critical} critical (within 7 days)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {summary.warning > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                <AlertTriangle size={10} />
                {summary.warning}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{summary.warning} warning (within 30 days)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

/**
 * Individual deadline item.
 */
function DeadlineItem({
  deadline,
  onAcknowledge,
  onSnooze,
  isUpdating,
}: {
  deadline: DeadlineAlert;
  onAcknowledge: () => void;
  onSnooze: () => void;
  isUpdating: boolean;
}) {
  const colors = getSeverityColors(deadline.severity);
  const Icon = getAlertIcon(deadline.alertType);

  return (
    <div className={cn('px-4 py-3', colors.bg)}>
      <div className="flex items-start gap-3">
        {/* Severity indicator */}
        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', colors.dot)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon size={14} className={colors.icon} />
            <span className={cn('text-sm font-medium', colors.text)}>
              {formatDaysRemaining(deadline.daysRemaining)}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">
              {getAlertTypeLabel(deadline.alertType)}
            </span>
          </div>
          <p className="text-sm text-slate-700 line-clamp-1">{deadline.message}</p>
          {deadline.caseInfo && (
            <Link
              href={`/dashboard/cases/${deadline.caseId}`}
              className="text-xs text-slate-500 hover:text-purple-600 flex items-center gap-1 mt-1"
            >
              <FileText size={10} />
              {deadline.caseInfo.title}
            </Link>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSnooze}
                  disabled={isUpdating}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                >
                  <BellOff size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Snooze for 1 day</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAcknowledge}
                  disabled={isUpdating}
                  className="h-7 w-7 p-0 text-green-500 hover:text-green-600 hover:bg-green-50"
                >
                  <Check size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark as handled</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component.
 */
function EmptyState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50',
        className
      )}
    >
      <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
      <h4 className="text-sm font-medium text-slate-700 mb-1">
        No upcoming deadlines
      </h4>
      <p className="text-xs text-slate-500">
        All deadlines are more than 60 days away.
      </p>
    </div>
  );
}

/**
 * Get icon for alert type.
 */
function getAlertIcon(alertType: DeadlineAlert['alertType']) {
  switch (alertType) {
    case 'case_deadline':
      return Calendar;
    case 'document_expiry':
      return FileText;
    case 'processing_estimate':
      return Clock;
  }
}

/**
 * Compact deadline badge for case cards.
 */
export function DeadlineBadge({
  daysRemaining,
  severity,
  className,
}: {
  daysRemaining: number;
  severity: DeadlineAlert['severity'];
  className?: string;
}) {
  const colors = getSeverityColors(severity);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium',
              colors.bg,
              colors.text,
              className
            )}
          >
            <Clock size={10} />
            {formatDaysRemaining(daysRemaining)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Deadline: {formatDaysRemaining(daysRemaining)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { SummaryBadges, DeadlineItem };
