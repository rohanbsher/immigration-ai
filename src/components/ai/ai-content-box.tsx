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
    default: 'border-l-2 border-dashed border-ai-accent/60 bg-ai-accent-muted/50 dark:bg-ai-accent-muted/20',
    subtle: 'border-l-2 border-ai-accent/30 bg-ai-accent-muted/30 dark:bg-ai-accent-muted/10',
    bordered: 'border border-dashed border-ai-accent/40 rounded-lg bg-ai-accent-muted/30 dark:bg-ai-accent-muted/10',
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
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-ai-accent dark:text-ai-accent">
          {showIcon && <Sparkles size={14} className="text-ai-accent" />}
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
        'rounded-lg border border-ai-accent/30 dark:border-ai-accent/20',
        'bg-gradient-to-br from-ai-accent-muted/50 to-card dark:from-ai-accent-muted/20 dark:to-card',
        'shadow-sm',
        className
      )}
    >
      {(title || description) && (
        <div className="px-4 py-3 border-b border-ai-accent/20 dark:border-ai-accent/15">
          <div className="flex items-center gap-2">
            {icon || <Sparkles size={16} className="text-ai-accent" />}
            {title && (
              <h3 className="text-sm font-semibold text-foreground dark:text-foreground">
                {title}
              </h3>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs text-ai-accent dark:text-ai-accent">
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
        'bg-ai-accent-muted text-ai-accent',
        'dark:bg-ai-accent-muted dark:text-ai-accent',
        className
      )}
    >
      {children}
    </span>
  );
}
