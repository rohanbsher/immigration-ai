'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  X,
  CheckCircle2,
  Circle,
  FolderOpen,
  Users,
  FileUp,
  Sparkles,
  Building2,
  PartyPopper,
  Rocket,
} from 'lucide-react';

const STORAGE_KEY = 'casefill-onboarding';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'create-case',
    title: 'Create your first case',
    description: 'Start an immigration case for a client',
    href: '/dashboard/cases/new',
    icon: FolderOpen,
  },
  {
    id: 'add-client',
    title: 'Add a client',
    description: 'Register a client to manage their immigration journey',
    href: '/dashboard/clients',
    icon: Users,
  },
  {
    id: 'upload-document',
    title: 'Upload a document',
    description: 'Upload passports, forms, or supporting documents',
    href: '/dashboard/documents',
    icon: FileUp,
  },
  {
    id: 'review-recommendations',
    title: 'Review AI recommendations',
    description: 'See AI-powered insights on your cases',
    href: '/dashboard/cases',
    icon: Sparkles,
  },
  {
    id: 'setup-firm',
    title: 'Set up your firm profile',
    description: 'Configure your firm details and invite team members',
    href: '/dashboard/firm',
    icon: Building2,
  },
];

interface OnboardingState {
  dismissed: boolean;
  completedSteps: string[];
}

function loadState(): OnboardingState {
  if (typeof window === 'undefined') {
    return { dismissed: false, completedSteps: [] };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Corrupted data -- reset
  }
  return { dismissed: false, completedSteps: [] };
}

function saveState(state: OnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable
  }
}

const emptySubscribe = () => () => {};

export function OnboardingChecklist() {
  const [state, setState] = useState<OnboardingState>(() => {
    if (typeof window === 'undefined') return { dismissed: false, completedSteps: [] };
    return loadState();
  });
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const toggleStep = useCallback((stepId: string) => {
    setState((prev) => {
      const isCompleted = prev.completedSteps.includes(stepId);
      const completedSteps = isCompleted
        ? prev.completedSteps.filter((id) => id !== stepId)
        : [...prev.completedSteps, stepId];
      const next = { ...prev, completedSteps };
      saveState(next);
      return next;
    });
  }, []);

  const dismiss = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, dismissed: true };
      saveState(next);
      return next;
    });
  }, []);

  // Don't render on server or before hydration
  if (!mounted) return null;

  // Don't render if dismissed
  if (state.dismissed) return null;

  const completedCount = state.completedSteps.length;
  const totalSteps = ONBOARDING_STEPS.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const allComplete = completedCount === totalSteps;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Getting Started
                </h3>
                <p className="text-xs text-muted-foreground">
                  {allComplete
                    ? 'All done! You are all set.'
                    : `${completedCount} of ${totalSteps} steps complete`}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={dismiss}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss onboarding checklist"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="px-6 pb-4">
            <Progress
              value={progressPercent}
              className="h-2 bg-muted"
              indicatorClassName={cn(
                'transition-all duration-500',
                allComplete ? 'bg-primary' : 'bg-primary'
              )}
            />
          </div>

          {/* Celebration banner */}
          <AnimatePresence>
            {allComplete && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mx-6 mb-4 flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3">
                  <PartyPopper className="h-5 w-5 text-primary shrink-0" />
                  <p className="text-sm font-medium text-primary">
                    Congratulations! You have completed all onboarding steps. You can dismiss this checklist now.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Steps */}
          <div className="px-6 pb-5">
            <ul className="space-y-1" role="list">
              {ONBOARDING_STEPS.map((step) => {
                const isCompleted = state.completedSteps.includes(step.id);
                const Icon = step.icon;

                return (
                  <li key={step.id}>
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                        isCompleted
                          ? 'bg-muted/50'
                          : 'hover:bg-muted/30'
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleStep(step.id)}
                        className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        aria-label={`Mark "${step.title}" as ${isCompleted ? 'incomplete' : 'complete'}`}
                      >
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          >
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          </motion.div>
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </button>

                      {/* Icon */}
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isCompleted
                            ? 'text-muted-foreground'
                            : 'text-foreground'
                        )}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <Link
                          href={step.href}
                          className={cn(
                            'text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
                            isCompleted
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground'
                          )}
                        >
                          {step.title}
                        </Link>
                        <p
                          className={cn(
                            'text-xs',
                            isCompleted
                              ? 'text-muted-foreground/60'
                              : 'text-muted-foreground'
                          )}
                        >
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
