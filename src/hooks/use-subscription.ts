'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlanType, BillingPeriod, PlanLimits } from '@/lib/db/subscriptions';
import type { UsageData } from '@/types/billing';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

interface Subscription {
  id: string;
  planType: PlanType;
  status: string;
  billingPeriod: BillingPeriod | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

interface Customer {
  customerId: string;
  email: string;
  name: string | null;
}

interface SubscriptionData {
  subscription: Subscription | null;
  customer: Customer | null;
  limits: PlanLimits;
  availablePlans: PlanLimits[];
  stripeConfigured?: boolean;
}

interface CheckoutParams {
  planType: 'pro' | 'enterprise';
  billingPeriod: 'monthly' | 'yearly';
}

async function fetchSubscription(): Promise<SubscriptionData> {
  const response = await fetchWithTimeout('/api/billing/subscription');

  if (!response.ok) {
    throw new Error('Failed to fetch subscription');
  }

  const data = await response.json();
  return data.data;
}

async function createCheckout(params: CheckoutParams): Promise<{ url: string }> {
  const response = await fetchWithTimeout('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout');
  }

  const data = await response.json();
  return data.data;
}

async function createPortalSession(): Promise<{ url: string }> {
  const response = await fetchWithTimeout('/api/billing/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create portal session');
  }

  const data = await response.json();
  return data.data;
}

async function cancelSubscription(immediately = false): Promise<void> {
  const response = await fetchWithTimeout('/api/billing/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ immediately }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel subscription');
  }
}

async function resumeSubscription(): Promise<void> {
  const response = await fetchWithTimeout('/api/billing/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to resume subscription');
  }
}

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: fetchSubscription,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCheckout,
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: createPortalSession,
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useResumeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resumeSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useIsSubscribed(planTypes?: PlanType[]) {
  const { data, isLoading } = useSubscription();

  if (isLoading || !data?.subscription) {
    return { isSubscribed: false, isLoading };
  }

  const activeStatuses = ['trialing', 'active'];
  const isActive = activeStatuses.includes(data.subscription.status);

  if (!planTypes || planTypes.length === 0) {
    return { isSubscribed: isActive, isLoading: false };
  }

  return {
    isSubscribed: isActive && planTypes.includes(data.subscription.planType),
    isLoading: false,
  };
}

export function useHasFeature(feature: keyof PlanLimits['features']) {
  const { data, isLoading } = useSubscription();

  if (isLoading || !data?.limits) {
    return { hasFeature: false, isLoading };
  }

  return {
    hasFeature: data.limits.features[feature] === true,
    isLoading: false,
  };
}

export function useQuotaCheck(metric: 'maxCases' | 'maxDocumentsPerCase' | 'maxAiRequestsPerMonth' | 'maxTeamMembers') {
  const { data, isLoading } = useSubscription();

  if (isLoading || !data?.limits) {
    return {
      limit: 0,
      isUnlimited: false,
      isLoading,
    };
  }

  const limit = data.limits[metric];

  return {
    limit,
    isUnlimited: limit === -1,
    isLoading: false,
  };
}

async function fetchUsage(): Promise<UsageData> {
  const response = await fetchWithTimeout('/api/billing/usage');

  if (!response.ok) {
    throw new Error('Failed to fetch usage data');
  }

  const data = await response.json();
  return data.data;
}

export function useUsage() {
  return useQuery({
    queryKey: ['billing-usage'],
    queryFn: fetchUsage,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
}
