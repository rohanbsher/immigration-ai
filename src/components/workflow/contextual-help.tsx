'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface HelpTooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function HelpTooltip({
  content,
  children,
  className,
  side = 'top',
}: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors',
                className
              )}
            >
              <HelpCircle size={16} />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs bg-popover text-popover-foreground border border-border shadow-lg"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FieldHelpProps {
  title: string;
  description: string;
  example?: string;
  className?: string;
}

export function FieldHelp({ title, description, example, className }: FieldHelpProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
            >
              <Info size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-sm p-4">
            <div className="space-y-2">
              <p className="font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
              {example && (
                <div className="mt-2 p-2 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Example:</p>
                  <p className="text-sm font-mono">{example}</p>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

interface ImmigrationTermProps {
  term: string;
  definition: string;
  children: React.ReactNode;
  className?: string;
}

export function ImmigrationTerm({
  term,
  definition,
  children,
  className,
}: ImmigrationTermProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'border-b border-dashed border-primary/50 cursor-help text-primary hover:border-primary transition-colors',
              className
            )}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm p-4">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{term}</p>
            <p className="text-sm text-muted-foreground">{definition}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ExpandableHelpProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function ExpandableHelp({
  title,
  children,
  defaultOpen = false,
  className,
}: ExpandableHelpProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('rounded-lg border border-border bg-muted/30', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Info size={18} className="text-primary" />
          <span className="font-medium text-foreground">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp size={18} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={18} className="text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-sm text-muted-foreground">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
