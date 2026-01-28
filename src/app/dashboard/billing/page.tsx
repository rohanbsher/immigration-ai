'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSubscription,
  useCheckout,
  useBillingPortal,
  useCancelSubscription,
  useResumeSubscription,
} from '@/hooks/use-subscription';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { PlanCard } from './components/plan-card';
import { CurrentPlan } from './components/current-plan';
import { UsageMeter } from './components/usage-meter';
import type { PlanType } from '@/lib/db/subscriptions';

const PLAN_ORDER: PlanType[] = ['free', 'pro', 'enterprise'];

export default function BillingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const { data, isLoading, error } = useSubscription();
  const checkout = useCheckout();
  const billingPortal = useBillingPortal();
  const cancelSubscription = useCancelSubscription();
  const resumeSubscription = useResumeSubscription();

  const handleUpgrade = (planType: 'pro' | 'enterprise') => {
    checkout.mutate(
      { planType, billingPeriod },
      {
        onError: (error) => {
          toast.error(error.message || 'Failed to start checkout');
        },
      }
    );
  };

  const handleManageSubscription = () => {
    billingPortal.mutate(undefined, {
      onError: (error) => {
        toast.error(error.message || 'Failed to open billing portal');
      },
    });
  };

  const handleCancelSubscription = () => {
    cancelSubscription.mutate(false, {
      onSuccess: () => {
        toast.success('Subscription will be canceled at the end of the billing period');
        setShowCancelDialog(false);
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to cancel subscription');
      },
    });
  };

  const handleResumeSubscription = () => {
    resumeSubscription.mutate(undefined, {
      onSuccess: () => {
        toast.success('Subscription resumed successfully');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to resume subscription');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load billing information</p>
        <p className="text-sm text-slate-500 mt-2">Please try again later</p>
      </div>
    );
  }

  const currentPlanType = data?.subscription?.planType || 'free';
  const subscription = data?.subscription;
  const limits = data?.limits;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing & Subscription</h1>
        <p className="text-slate-600">Manage your plan and billing information</p>
      </div>

      {/* Current Plan */}
      {subscription && (
        <CurrentPlan
          planType={subscription.planType}
          status={subscription.status}
          billingPeriod={subscription.billingPeriod}
          currentPeriodEnd={subscription.currentPeriodEnd}
          cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          onManage={handleManageSubscription}
          onCancel={() => setShowCancelDialog(true)}
          onResume={handleResumeSubscription}
          isManageLoading={billingPortal.isPending}
          isCancelLoading={cancelSubscription.isPending}
          isResumeLoading={resumeSubscription.isPending}
        />
      )}

      {/* Usage */}
      {limits && (
        <UsageMeter
          limits={limits}
          usage={{
            cases: 0, // TODO: Fetch actual usage from API
            documents: 0,
            aiRequests: 0,
            teamMembers: 1,
          }}
        />
      )}

      {/* Plan Comparison */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Available Plans</h2>
          <Tabs
            value={billingPeriod}
            onValueChange={(v) => setBillingPeriod(v as 'monthly' | 'yearly')}
          >
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">
                Yearly
                <span className="ml-1 text-xs text-green-600 font-medium">(Save 20%)</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLAN_ORDER.map((planType) => (
            <PlanCard
              key={planType}
              planType={planType}
              isCurrentPlan={currentPlanType === planType}
              billingPeriod={billingPeriod}
              onSelect={handleUpgrade}
              isLoading={checkout.isPending}
            />
          ))}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Cancel Subscription"
        description="Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period."
        confirmLabel="Cancel Subscription"
        onConfirm={handleCancelSubscription}
        variant="destructive"
      />
    </div>
  );
}
