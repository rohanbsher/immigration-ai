'use client';

import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { ReactNode } from 'react';

interface AIContentBoxProps {
  children: ReactNode;
  title?: string;
  showIcon?: boolean;
  variant?: 'default' | 'subtle' | 'bordered';
  className?: string;
}

/**
 * AI Content Box - Container for AI-generated content.
 *
 * Uses dashed purple left border and subtle background to distinguish
 * AI-generated content from user/system content.
 */
export function AIContentBox({
  children,
  title,
  showIcon = true,
  variant = 'default',
  className,
}: AIContentBoxProps) {
  const variantClasses = {
    default: 'border-l-2 border-dashed border-purple-400 bg-purple-50/50 dark:bg-purple-950/20',
    subtle: 'border-l-2 border-purple-200 bg-purple-50/30 dark:bg-purple-950/10',
    bordered: 'border border-dashed border-purple-300 rounded-lg bg-purple-50/30 dark:bg-purple-950/10',
  };

  return (
    <div
      className={cn(
        'p-4',
        variantClasses[variant],
        className
      )}
    >
      {title && (
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-purple-700 dark:text-purple-300">
          {showIcon && <Sparkles size={14} className="text-purple-500" />}
          <span>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

interface AICardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}

/**
 * AI Card - A more structured container for AI content with header.
 */
export function AICard({
  children,
  title,
  description,
  icon,
  className,
}: AICardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-purple-200 dark:border-purple-800',
        'bg-gradient-to-br from-purple-50/50 to-white dark:from-purple-950/20 dark:to-slate-900',
        'shadow-sm',
        className
      )}
    >
      {(title || description) && (
        <div className="px-4 py-3 border-b border-purple-100 dark:border-purple-800">
          <div className="flex items-center gap-2">
            {icon || <Sparkles size={16} className="text-purple-500" />}
            {title && (
              <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                {title}
              </h3>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

interface AIHighlightProps {
  children: ReactNode;
  className?: string;
}

/**
 * AI Highlight - Inline highlight for AI-generated text.
 */
export function AIHighlight({ children, className }: AIHighlightProps) {
  return (
    <span
      className={cn(
        'px-1 py-0.5 rounded',
        'bg-purple-100 text-purple-800',
        'dark:bg-purple-900/50 dark:text-purple-200',
        className
      )}
    >
      {children}
    </span>
  );
}
