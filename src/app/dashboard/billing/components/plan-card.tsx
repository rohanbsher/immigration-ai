'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLAN_FEATURES, formatLimit, getYearlySavings } from '@/lib/billing/limits';
import type { PlanType } from '@/lib/db/subscriptions';

interface PlanCardProps {
  planType: PlanType;
  isCurrentPlan: boolean;
  billingPeriod: 'monthly' | 'yearly';
  onSelect: (planType: 'pro' | 'enterprise') => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  documentAnalysis: 'Document Analysis',
  formAutofill: 'AI Form Autofill',
  prioritySupport: 'Priority Support',
  apiAccess: 'API Access',
  teamCollaboration: 'Team Collaboration',
  customBranding: 'Custom Branding',
  advancedReporting: 'Advanced Reporting',
};

export function PlanCard({
  planType,
  isCurrentPlan,
  billingPeriod,
  onSelect,
  isLoading,
  disabled,
}: PlanCardProps) {
  const plan = PLAN_FEATURES[planType];
  const price = plan.price[billingPeriod];
  const yearlySavings = getYearlySavings(planType);
  const isPopular = planType === 'pro';

  return (
    <Card
      className={cn(
        'relative flex flex-col',
        isCurrentPlan && 'ring-2 ring-primary',
        isPopular && !isCurrentPlan && 'ring-1 ring-primary/30'
      )}
    >
      {isPopular && !isCurrentPlan && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary">
          Most Popular
        </Badge>
      )}
      {isCurrentPlan && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-success">
          Current Plan
        </Badge>
      )}

      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">${price}</span>
          {price > 0 && (
            <span className="text-muted-foreground ml-1">
              /{billingPeriod === 'monthly' ? 'month' : 'month, billed yearly'}
            </span>
          )}
        </div>
        {billingPeriod === 'yearly' && yearlySavings > 0 && (
          <p className="text-sm text-success font-medium mt-1">
            Save ${yearlySavings}/year
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-6">
        {/* Limits */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Limits</p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <Check size={16} className="text-success flex-shrink-0" />
              <span>{formatLimit(plan.limits.maxCases)} cases</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-success flex-shrink-0" />
              <span>{formatLimit(plan.limits.maxDocumentsPerCase)} docs/case</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-success flex-shrink-0" />
              <span>{formatLimit(plan.limits.maxAiRequestsPerMonth)} AI requests/month</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-success flex-shrink-0" />
              <span>{formatLimit(plan.limits.maxTeamMembers)} team members</span>
            </li>
          </ul>
        </div>

        {/* Features */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Features</p>
          <ul className="space-y-1.5 text-sm">
            {Object.entries(plan.features).map(([key, enabled]) => (
              <li key={key} className="flex items-center gap-2">
                {enabled ? (
                  <Check size={16} className="text-success flex-shrink-0" />
                ) : (
                  <X size={16} className="text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className={cn(!enabled && 'text-muted-foreground')}>
                  {FEATURE_LABELS[key] || key}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Button */}
        <div className="pt-4">
          {isCurrentPlan ? (
            <Button variant="outline" className="w-full" disabled>
              Current Plan
            </Button>
          ) : planType === 'free' ? (
            <Button variant="outline" className="w-full" disabled>
              Free Plan
            </Button>
          ) : planType === 'enterprise' ? (
            <Button
              className="w-full"
              onClick={() => onSelect('enterprise')}
              disabled={isLoading || disabled}
            >
              {isLoading ? 'Processing...' : 'Upgrade to Enterprise'}
            </Button>
          ) : (
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              onClick={() => onSelect('pro')}
              disabled={isLoading || disabled}
            >
              {isLoading ? 'Processing...' : 'Upgrade to Pro'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
