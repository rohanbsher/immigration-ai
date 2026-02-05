import type { PlanType } from '@/lib/db/subscriptions';

export const PLAN_FEATURES = {
  free: {
    name: 'Free',
    description: 'Get started with basic features',
    price: {
      monthly: 0,
      yearly: 0,
    },
    limits: {
      maxCases: 5,
      maxDocumentsPerCase: 10,
      maxAiRequestsPerMonth: 25,
      maxStorageGb: 1,
      maxTeamMembers: 1,
    },
    features: {
      documentAnalysis: true,
      formAutofill: false,
      prioritySupport: false,
      apiAccess: false,
      teamCollaboration: false,
      customBranding: false,
      advancedReporting: false,
    },
  },
  pro: {
    name: 'Pro',
    description: 'Perfect for solo practitioners',
    price: {
      monthly: 99,
      yearly: 79,
    },
    limits: {
      maxCases: 50,
      maxDocumentsPerCase: 50,
      maxAiRequestsPerMonth: 500,
      maxStorageGb: 25,
      maxTeamMembers: 5,
    },
    features: {
      documentAnalysis: true,
      formAutofill: true,
      prioritySupport: true,
      apiAccess: false,
      teamCollaboration: true,
      customBranding: false,
      advancedReporting: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For growing firms',
    price: {
      monthly: 299,
      yearly: 249,
    },
    limits: {
      maxCases: -1,
      maxDocumentsPerCase: -1,
      maxAiRequestsPerMonth: -1,
      maxStorageGb: 500,
      maxTeamMembers: -1,
    },
    features: {
      documentAnalysis: true,
      formAutofill: true,
      prioritySupport: true,
      apiAccess: true,
      teamCollaboration: true,
      customBranding: true,
      advancedReporting: true,
    },
  },
} as const;

export type PlanFeatures = typeof PLAN_FEATURES;
export type Plan = keyof PlanFeatures;

export function getPlanDetails(planType: PlanType) {
  return PLAN_FEATURES[planType] || PLAN_FEATURES.free;
}

export function formatLimit(value: number): string {
  if (value === -1) return 'Unlimited';
  return value.toLocaleString();
}

export function formatStorage(gb: number): string {
  if (gb >= 1000) return `${(gb / 1000).toFixed(0)} TB`;
  return `${gb} GB`;
}

export function formatPrice(amount: number, period: 'monthly' | 'yearly'): string {
  if (amount === 0) return 'Free';
  return `$${amount}/${period === 'monthly' ? 'mo' : 'mo (billed yearly)'}`;
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function getYearlySavings(planType: PlanType): number {
  const plan = PLAN_FEATURES[planType];
  if (!plan || plan.price.monthly === 0) return 0;
  return (plan.price.monthly - plan.price.yearly) * 12;
}
