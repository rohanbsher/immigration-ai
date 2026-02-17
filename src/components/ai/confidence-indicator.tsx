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
    high: 'text-success bg-success/10',
    medium: 'text-warning bg-warning/10',
    low: 'text-destructive bg-destructive/10',
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
    if (confidence >= 0.9) return 'bg-success';
    if (confidence >= 0.7) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-muted-foreground">Confidence</span>
        <span className="text-xs font-medium text-foreground">{percentage}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
