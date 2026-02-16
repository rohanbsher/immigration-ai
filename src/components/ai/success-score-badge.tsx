'use client';

import { cn } from '@/lib/utils';
import {
  useSuccessScore,
  getSuccessScoreColors,
  getSuccessScoreLabel,
} from '@/hooks/use-success-score';
import { Sparkles } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SuccessScoreBadgeProps {
  caseId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

/**
 * Success Score Badge - Compact display for case cards.
 *
 * Color-coded badge showing case success probability.
 */
export function SuccessScoreBadge({
  caseId,
  size = 'md',
  showLabel = false,
  showIcon = true,
  className,
}: SuccessScoreBadgeProps) {
  const { data, isLoading, error } = useSuccessScore(caseId);

  if (isLoading) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
          'bg-slate-100 text-slate-400 animate-pulse',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm',
          size === 'lg' && 'text-base',
          className
        )}
      >
        {showIcon && <Sparkles size={size === 'sm' ? 10 : 12} />}
        <span>—%</span>
      </span>
    );
  }

  if (error || !data || (data as typeof data & { degraded?: boolean }).degraded) {
    return null;
  }

  const colors = getSuccessScoreColors(data.overallScore);
  const label = getSuccessScoreLabel(data.overallScore);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 font-medium rounded-full',
              colors.bg,
              colors.text,
              size === 'sm' && 'text-xs px-1.5 py-0.5',
              size === 'md' && 'text-sm px-2 py-0.5',
              size === 'lg' && 'text-base px-2.5 py-1',
              className
            )}
          >
            {showIcon && <Sparkles size={size === 'sm' ? 10 : 12} />}
            <span>{data.overallScore}%</span>
            {showLabel && <span className="ml-0.5">{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Success Probability: {label}</p>
          <p className="text-xs text-slate-400">
            Based on {data.factors.length} factors
          </p>
          {data.riskFactors.length > 0 && (
            <p className="text-xs text-red-400 mt-1">
              {data.riskFactors.length} risk factor(s)
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface SuccessScoreStaticBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

/**
 * Static Success Score Badge - For when you already have the score.
 */
export function SuccessScoreStaticBadge({
  score,
  size = 'md',
  showLabel = false,
  showIcon = true,
  className,
}: SuccessScoreStaticBadgeProps) {
  const colors = getSuccessScoreColors(score);
  const label = getSuccessScoreLabel(score);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 font-medium rounded-full',
              colors.bg,
              colors.text,
              size === 'sm' && 'text-xs px-1.5 py-0.5',
              size === 'md' && 'text-sm px-2 py-0.5',
              size === 'lg' && 'text-base px-2.5 py-1',
              className
            )}
          >
            {showIcon && <Sparkles size={size === 'sm' ? 10 : 12} />}
            <span>{score}%</span>
            {showLabel && <span className="ml-0.5">{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Success Probability: {label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
