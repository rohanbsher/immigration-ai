'use client';

import { cn } from '@/lib/utils';
import { Sparkles, Loader2 } from 'lucide-react';

interface AILoadingProps {
  message?: string;
  variant?: 'default' | 'minimal' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * AI Loading - Animated loading indicator for AI operations.
 *
 * Shows "AI is thinking..." with animated dots to indicate AI processing.
 */
export function AILoading({
  message = 'AI is thinking',
  variant = 'default',
  size = 'md',
  className,
}: AILoadingProps) {
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

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-purple-600',
          sizeClasses[size],
          className
        )}
      >
        <Sparkles size={iconSizes[size]} className="animate-pulse" />
        <span>{message}</span>
        <AnimatedDots />
      </span>
    );
  }

  if (variant === 'minimal') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-purple-600',
          sizeClasses[size],
          className
        )}
      >
        <Loader2 size={iconSizes[size]} className="animate-spin" />
        <span>{message}</span>
        <AnimatedDots />
      </div>
    );
  }

  // Default variant with box
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6',
        'border border-dashed border-purple-300 rounded-lg',
        'bg-purple-50/50 dark:bg-purple-950/20',
        className
      )}
    >
      <div className="flex items-center gap-2 text-purple-600">
        <Sparkles size={iconSizes[size]} className="animate-pulse" />
        <span className={cn('font-medium', sizeClasses[size])}>
          {message}
          <AnimatedDots />
        </span>
      </div>
      <p className="mt-2 text-xs text-purple-500 dark:text-purple-400">
        This may take a few seconds
      </p>
    </div>
  );
}

/**
 * Animated dots component for loading states.
 */
function AnimatedDots() {
  return (
    <span className="inline-flex ml-0.5">
      <span className="animate-[bounce_1s_ease-in-out_infinite]">.</span>
      <span className="animate-[bounce_1s_ease-in-out_infinite_0.2s]">.</span>
      <span className="animate-[bounce_1s_ease-in-out_infinite_0.4s]">.</span>
    </span>
  );
}

interface AISkeletonProps {
  lines?: number;
  className?: string;
}

// Pre-computed widths for skeleton lines to avoid impure renders
const SKELETON_WIDTHS = ['85%', '72%', '90%', '65%', '78%', '95%', '68%', '82%', '76%', '88%'];

/**
 * AI Skeleton - Placeholder skeleton for AI content loading.
 */
export function AISkeleton({ lines = 3, className }: AISkeletonProps) {
  return (
    <div
      className={cn(
        'space-y-2 p-4',
        'border border-dashed border-purple-200 rounded-lg',
        'bg-purple-50/30 dark:bg-purple-950/10',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded bg-purple-200 animate-pulse" />
        <div className="w-24 h-4 rounded bg-purple-200 animate-pulse" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-purple-100 animate-pulse"
          style={{
            width: SKELETON_WIDTHS[i % SKELETON_WIDTHS.length],
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
