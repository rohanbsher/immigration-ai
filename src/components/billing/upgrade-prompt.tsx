'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { QuotaCheck, QuotaMetric } from '@/hooks/use-quota';

const METRIC_LABELS: Record<QuotaMetric, { singular: string; plural: string }> = {
  cases: { singular: 'case', plural: 'cases' },
  documents: { singular: 'document', plural: 'documents' },
  ai_requests: { singular: 'AI request', plural: 'AI requests' },
  storage: { singular: 'GB of storage', plural: 'GB of storage' },
  team_members: { singular: 'team member', plural: 'team members' },
};

interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: QuotaMetric;
  quota: QuotaCheck;
}

export function UpgradePromptDialog({
  open,
  onOpenChange,
  metric,
  quota,
}: UpgradePromptDialogProps) {
  const labels = METRIC_LABELS[metric];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Limit Reached
          </DialogTitle>
          <DialogDescription>
            You&apos;ve reached your plan&apos;s limit for {labels.plural}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Current Usage</span>
              <span className="font-semibold">
                {quota.current} / {quota.limit} {labels.plural}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-warning h-2 rounded-full"
                style={{ width: `${Math.min(100, (quota.current / quota.limit) * 100)}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Upgrade to Pro or Enterprise to unlock more {labels.plural} and additional features.
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button asChild>
            <Link href="/dashboard/billing">
              <Zap className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UpgradePromptBannerProps {
  metric: QuotaMetric;
  quota: QuotaCheck;
  className?: string;
}

export function UpgradePromptBanner({ metric, quota, className }: UpgradePromptBannerProps) {
  const labels = METRIC_LABELS[metric];
  const usagePercent = (quota.current / quota.limit) * 100;

  if (usagePercent < 80) return null;

  const isAtLimit = usagePercent >= 100;

  return (
    <Alert
      variant={isAtLimit ? 'destructive' : 'warning'}
      className={className}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {isAtLimit ? 'Limit Reached' : 'Approaching Limit'}
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span>
          {isAtLimit
            ? `You've used all ${quota.limit} ${labels.plural} in your plan.`
            : `You've used ${quota.current} of ${quota.limit} ${labels.plural} (${Math.round(usagePercent)}%).`}
        </span>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/dashboard/billing">
            Upgrade
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

interface QuotaUsageIndicatorProps {
  metric: QuotaMetric;
  quota: QuotaCheck;
  showLabel?: boolean;
  className?: string;
}

export function QuotaUsageIndicator({
  metric,
  quota,
  showLabel = true,
  className,
}: QuotaUsageIndicatorProps) {
  const labels = METRIC_LABELS[metric];

  if (quota.isUnlimited) {
    return showLabel ? (
      <span className={`text-sm text-muted-foreground ${className}`}>Unlimited {labels.plural}</span>
    ) : null;
  }

  const usagePercent = Math.min(100, (quota.current / quota.limit) * 100);
  const colorClass =
    usagePercent >= 100
      ? 'bg-destructive'
      : usagePercent >= 80
        ? 'bg-warning'
        : 'bg-success';

  return (
    <div className={`space-y-1 ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground capitalize">{labels.plural}</span>
          <span className="text-foreground font-medium">
            {quota.current} / {quota.limit}
          </span>
        </div>
      )}
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className={`${colorClass} h-1.5 rounded-full transition-all`}
          style={{ width: `${usagePercent}%` }}
        />
      </div>
    </div>
  );
}
