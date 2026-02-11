'use client';

import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getConfidenceLevel } from '@/lib/ai/utils';

interface ConfidenceIndicatorProps {
  confidence: number;
  showLabel?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConfidenceIndicator({
  confidence,
  showLabel = true,
  showIcon = true,
  size = 'md',
  className,
}: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100);
  const level = getConfidenceLevel(confidence);

  const colorClasses = {
    high: 'text-green-600 bg-green-50',
    medium: 'text-yellow-600 bg-yellow-50',
    low: 'text-red-600 bg-red-50',
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  const Icon = level === 'high' ? CheckCircle : level === 'medium' ? AlertTriangle : AlertCircle;

  const tooltipText = {
    high: 'High confidence - likely accurate',
    medium: 'Medium confidence - should be verified',
    low: 'Low confidence - requires manual review',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
              colorClasses[level],
              sizeClasses[size],
              className
            )}
          >
            {showIcon && <Icon size={iconSizes[size]} />}
            {showLabel && <span className="font-medium">{percentage}%</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText[level]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ConfidenceBarProps {
  confidence: number;
  className?: string;
}

export function ConfidenceBar({ confidence, className }: ConfidenceBarProps) {
  const percentage = Math.round(confidence * 100);

  const getColor = () => {
    if (confidence >= 0.9) return 'bg-green-500';
    if (confidence >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-500">Confidence</span>
        <span className="text-xs font-medium text-slate-700">{percentage}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
