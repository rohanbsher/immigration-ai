'use client';

import { cn } from '@/lib/utils';
import {
  useSuccessScore,
  getSuccessScoreColors,
  getSuccessScoreLabel,
  getFactorStatusInfo,
} from '@/hooks/use-success-score';
import { AIContentBox, AILoading, AIBadge } from '@/components/ai';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ScoringFactor } from '@/lib/ai/success-probability';

interface SuccessScoreBreakdownProps {
  caseId: string;
  variant?: 'full' | 'compact';
  showImprovements?: boolean;
  className?: string;
}

/**
 * Success Score Breakdown - Detailed view of scoring factors.
 */
export function SuccessScoreBreakdown({
  caseId,
  variant = 'full',
  showImprovements = true,
  className,
}: SuccessScoreBreakdownProps) {
  const { data, isLoading, error } = useSuccessScore(caseId);
  const [isExpanded, setIsExpanded] = useState(variant === 'full');

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <AILoading message="Calculating score" variant="minimal" />
      </div>
    );
  }

  // Show empty state for errors or degraded results (missing AI keys, no data, etc.)
  const isDegraded = error || !data || (data as typeof data & { degraded?: boolean })?.degraded || typeof data?.overallScore !== 'number';

  if (isDegraded) {
    return (
      <div className={cn('p-4 rounded-lg border border-dashed border-border bg-muted/50', className)}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <TrendingUp size={20} />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Success Score</p>
            <p className="text-xs text-muted-foreground/70">
              Upload documents and create forms to see your success probability.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const colors = getSuccessScoreColors(data.overallScore);
  const label = getSuccessScoreLabel(data.overallScore);

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Header with score */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <ScoreGauge score={data.overallScore} size={48} />
            <div className="text-left">
              <div className="text-lg font-bold">{data.overallScore}%</div>
              <div className={cn('text-xs', colors.text)}>{label}</div>
            </div>
          </div>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Expanded details */}
        {isExpanded && (
          <div className="space-y-3 pt-2">
            {data.factors?.map((factor) => (
              <FactorBar key={factor.name} factor={factor} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <AIContentBox
      title="Success Probability"
      variant="bordered"
      className={className}
    >
      {/* Score Overview */}
      <div className="flex items-center gap-6 mb-6">
        <ScoreGauge score={data.overallScore} size={80} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-2xl font-bold', colors.text)}>
              {data.overallScore}%
            </span>
            <span className={cn('text-sm', colors.text)}>{label}</span>
            <AIBadge size="sm" label="AI" showTooltip tooltipText="AI-powered analysis" />
          </div>
          <p className="text-sm text-muted-foreground">
            Based on {data.factors?.length ?? 0} scoring factors
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Confidence: {Math.round((data.confidence ?? 0) * 100)}%
          </p>
        </div>
      </div>

      {/* Factors Breakdown */}
      <div className="space-y-4 mb-6">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <TrendingUp size={14} />
          Scoring Factors
        </h4>
        <div className="space-y-3">
          {data.factors?.map((factor) => (
            <FactorRow key={factor.name} factor={factor} />
          ))}
        </div>
      </div>

      {/* Risk Factors */}
      {(data.riskFactors?.length ?? 0) > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-destructive flex items-center gap-2 mb-2">
            <AlertTriangle size={14} />
            Risk Factors ({data.riskFactors?.length ?? 0})
          </h4>
          <ul className="space-y-1">
            {data.riskFactors?.map((risk, index) => (
              <li
                key={index}
                className="text-sm text-destructive flex items-start gap-2"
              >
                <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {showImprovements && (data.improvements?.length ?? 0) > 0 && (
        <div className="pt-4 border-t border-ai-accent/20">
          <h4 className="text-sm font-medium text-success-foreground flex items-center gap-2 mb-2">
            <TrendingUp size={14} />
            How to Improve
          </h4>
          <ul className="space-y-1">
            {data.improvements?.map((improvement, index) => (
              <li
                key={index}
                className="text-sm text-success flex items-start gap-2"
              >
                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                {improvement}
              </li>
            ))}
          </ul>
        </div>
      )}
    </AIContentBox>
  );
}

/**
 * Circular score gauge.
 */
function ScoreGauge({
  score,
  size = 80,
}: {
  score: number;
  size?: number;
}) {
  const colors = getSuccessScoreColors(score);
  const strokeWidth = size > 60 ? 8 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  // Get stroke color based on score
  const getStrokeColor = () => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('font-bold', colors.text, size > 60 ? 'text-lg' : 'text-sm')}>
          {score}
        </span>
      </div>
    </div>
  );
}

/**
 * Factor row with progress bar and details.
 */
function FactorRow({ factor }: { factor: ScoringFactor }) {
  const statusInfo = getFactorStatusInfo(factor.status);

  const StatusIcon =
    factor.status === 'good'
      ? CheckCircle2
      : factor.status === 'warning'
      ? AlertTriangle
      : XCircle;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon size={14} className={statusInfo.color} />
          <span className="text-sm font-medium text-foreground">{factor.name}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info size={12} className="text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{factor.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Weight: {Math.round(factor.weight * 100)}%
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          {factor.rawValue && (
            <span className="text-xs text-muted-foreground">{factor.rawValue}</span>
          )}
          <span className={cn('text-sm font-medium', statusInfo.color)}>
            {factor.score}%
          </span>
        </div>
      </div>
      <Progress value={factor.score} className="h-1.5" />
    </div>
  );
}

/**
 * Compact factor bar.
 */
function FactorBar({ factor }: { factor: ScoringFactor }) {
  const statusInfo = getFactorStatusInfo(factor.status);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-24 truncate">{factor.name}</span>
      <div className="flex-1">
        <Progress value={factor.score} className="h-1.5" />
      </div>
      <span className={cn('text-xs font-medium w-8 text-right', statusInfo.color)}>
        {factor.score}%
      </span>
    </div>
  );
}

export { ScoreGauge };
