'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Calendar, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLAN_FEATURES } from '@/lib/billing/limits';
import type { PlanType, BillingPeriod } from '@/lib/db/subscriptions';

interface CurrentPlanProps {
  planType: PlanType;
  status: string;
  billingPeriod: BillingPeriod | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  onManage: () => void;
  onCancel: () => void;
  onResume: () => void;
  isManageLoading?: boolean;
  isCancelLoading?: boolean;
  isResumeLoading?: boolean;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/10 text-success' },
  trialing: { label: 'Trial', className: 'bg-info/10 text-info' },
  past_due: { label: 'Past Due', className: 'bg-destructive/10 text-destructive' },
  canceled: { label: 'Canceled', className: 'bg-muted text-muted-foreground' },
  paused: { label: 'Paused', className: 'bg-warning/10 text-warning' },
};

export function CurrentPlan({
  planType,
  status,
  billingPeriod,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  onManage,
  onCancel,
  onResume,
  isManageLoading,
  isCancelLoading,
  isResumeLoading,
}: CurrentPlanProps) {
  const plan = PLAN_FEATURES[planType];
  const price = billingPeriod ? plan.price[billingPeriod] : 0;
  const statusBadge = STATUS_BADGES[status] || STATUS_BADGES.active;

  const formattedEndDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>Your subscription details</CardDescription>
          </div>
          <Badge className={cn('font-medium', statusBadge.className)}>
            {statusBadge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Info */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="text-lg font-semibold">{plan.name} Plan</p>
            {price > 0 && (
              <p className="text-muted-foreground">
                ${price}/{billingPeriod === 'monthly' ? 'month' : 'month, billed yearly'}
              </p>
            )}
          </div>
          {planType !== 'free' && formattedEndDate && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar size={14} />
                <span>Next billing</span>
              </div>
              <p className="font-medium">{formattedEndDate}</p>
            </div>
          )}
        </div>

        {/* Cancel Warning */}
        {cancelAtPeriodEnd && (
          <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning-foreground">Subscription ending</p>
              <p className="text-sm text-warning-foreground/80">
                Your subscription will be canceled on {formattedEndDate}. You&apos;ll lose access to
                premium features after this date.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {planType !== 'free' && (
            <Button variant="outline" onClick={onManage} disabled={isManageLoading}>
              {isManageLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Manage Subscription'
              )}
            </Button>
          )}

          {cancelAtPeriodEnd ? (
            <Button onClick={onResume} disabled={isResumeLoading}>
              {isResumeLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resuming...
                </>
              ) : (
                'Resume Subscription'
              )}
            </Button>
          ) : (
            planType !== 'free' && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                onClick={onCancel}
                disabled={isCancelLoading}
              >
                {isCancelLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Cancel Subscription'
                )}
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
