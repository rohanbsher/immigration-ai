'use client';

import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AIBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showTooltip?: boolean;
  tooltipText?: string;
  className?: string;
}

/**
 * AI Badge - Visual indicator for AI-powered features.
 *
 * Uses purple gradient to distinguish AI content throughout the app.
 */
export function AIBadge({
  size = 'md',
  label = 'AI',
  showTooltip = true,
  tooltipText = 'Powered by AI',
  className,
}: AIBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-0.5',
    md: 'text-sm px-2 py-0.5 gap-1',
    lg: 'text-base px-2.5 py-1 gap-1.5',
  };

  const iconSizes = {
    sm: 10,
    md: 14,
    lg: 16,
  };

  const badge = (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        'bg-ai-accent text-ai-accent-foreground',
        'shadow-sm',
        sizeClasses[size],
        className
      )}
    >
      <Sparkles size={iconSizes[size]} className="flex-shrink-0" />
      {label && <span>{label}</span>}
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface AIIconBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Smaller AI icon badge without text label.
 */
export function AIIconBadge({ size = 'md', className }: AIIconBadgeProps) {
  const sizeClasses = {
    sm: 'p-0.5',
    md: 'p-1',
    lg: 'p-1.5',
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        'bg-ai-accent text-ai-accent-foreground',
        sizeClasses[size],
        className
      )}
    >
      <Sparkles size={iconSizes[size]} />
    </span>
  );
}
