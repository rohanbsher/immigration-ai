import { BaseService } from './base-service';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete' | 'incomplete_expired';
export type PlanType = 'free' | 'pro' | 'enterprise';
export type BillingPeriod = 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  customerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  planType: PlanType;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  metricName: string;
  quantity: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface PlanLimits {
  planType: PlanType;
  maxCases: number;
  maxDocumentsPerCase: number;
  maxAiRequestsPerMonth: number;
  maxStorageGb: number;
  maxTeamMembers: number;
  features: {
    documentAnalysis: boolean;
    formAutofill: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
  };
}

function mapSubscriptionFromDb(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    stripeSubscriptionId: row.stripe_subscription_id as string | null,
    stripePriceId: row.stripe_price_id as string | null,
    planType: row.plan_type as PlanType,
    status: row.status as SubscriptionStatus,
    billingPeriod: row.billing_period as BillingPeriod | null,
    currentPeriodStart: row.current_period_start as string | null,
    currentPeriodEnd: row.current_period_end as string | null,
    cancelAtPeriodEnd: row.cancel_at_period_end as boolean,
    canceledAt: row.canceled_at as string | null,
    trialStart: row.trial_start as string | null,
    trialEnd: row.trial_end as string | null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPlanLimitsFromDb(row: Record<string, unknown>): PlanLimits {
  const features = row.features as Record<string, boolean> || {};
  return {
    planType: row.plan_type as PlanType,
    maxCases: row.max_cases as number,
    maxDocumentsPerCase: row.max_documents_per_case as number,
    maxAiRequestsPerMonth: row.max_ai_requests_per_month as number,
    maxStorageGb: Number(row.max_storage_gb),
    maxTeamMembers: row.max_team_members as number,
    features: {
      documentAnalysis: features.document_analysis ?? false,
      formAutofill: features.form_autofill ?? false,
      prioritySupport: features.priority_support ?? false,
      apiAccess: features.api_access ?? false,
    },
  };
}

class SubscriptionsService extends BaseService {
  constructor() {
    super('subscriptions');
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          customers!inner (
            user_id
          )
        `)
        .eq('customers.user_id', userId)
        .in('status', ['trialing', 'active', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return mapSubscriptionFromDb(data);
    }, 'getSubscriptionByUserId', { userId });
  }

  async getAllPlanLimits(): Promise<PlanLimits[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('plan_limits')
        .select('*')
        .order('plan_type');

      if (error) {
        throw new Error(`Failed to fetch plan limits: ${error.message}`);
      }

      return (data || []).map(mapPlanLimitsFromDb);
    }, 'getAllPlanLimits');
  }

  async getPlanLimits(planType: PlanType): Promise<PlanLimits | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('plan_limits')
        .select('*')
        .eq('plan_type', planType)
        .single();

      if (error || !data) {
        return null;
      }

      return mapPlanLimitsFromDb(data);
    }, 'getPlanLimits', { planType });
  }

  async getUserPlanLimits(userId: string): Promise<PlanLimits> {
    return this.withErrorHandling(async () => {
      const subscription = await this.getSubscriptionByUserId(userId);
      const planType = subscription?.planType || 'free';
      const limits = await this.getPlanLimits(planType);

      if (!limits) {
        return {
          planType: 'free',
          maxCases: 3,
          maxDocumentsPerCase: 10,
          maxAiRequestsPerMonth: 25,
          maxStorageGb: 1,
          maxTeamMembers: 1,
          features: {
            documentAnalysis: true,
            formAutofill: false,
            prioritySupport: false,
            apiAccess: false,
          },
        };
      }

      return limits;
    }, 'getUserPlanLimits', { userId });
  }

  async getCurrentUsage(userId: string): Promise<Record<string, number>> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase.rpc('get_current_usage', {
        p_subscription_id: userId,
      });

      if (error) {
        return {};
      }

      const usage: Record<string, number> = {};
      for (const row of data || []) {
        usage[row.metric_name] = row.quantity;
      }

      return usage;
    }, 'getCurrentUsage', { userId });
  }

  async incrementUsage(
    userId: string,
    metricName: string,
    quantity = 1
  ): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const subscription = await this.getSubscriptionByUserId(userId);
      if (!subscription) {
        return;
      }

      const { error } = await supabase.rpc('increment_usage', {
        p_subscription_id: subscription.id,
        p_metric_name: metricName,
        p_quantity: quantity,
      });

      if (error) {
        this.logger.logError('Failed to increment usage', error, { userId, metricName, quantity });
      }
    }, 'incrementUsage', { userId, metricName, quantity });
  }

  async checkQuota(
    userId: string,
    metricName: string,
    requiredQuantity = 1
  ): Promise<boolean> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase.rpc('check_quota', {
        p_user_id: userId,
        p_metric_name: metricName,
        p_required_quantity: requiredQuantity,
      });

      if (error) {
        return false;
      }

      return data === true;
    }, 'checkQuota', { userId, metricName, requiredQuantity });
  }

  async getUserInvoices(userId: string, limit = 10) {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers!inner (
            user_id
          )
        `)
        .eq('customers.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch invoices: ${error.message}`);
      }

      return data || [];
    }, 'getUserInvoices', { userId, limit });
  }

  async getUserPayments(userId: string, limit = 10) {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          customers!inner (
            user_id
          )
        `)
        .eq('customers.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch payments: ${error.message}`);
      }

      return data || [];
    }, 'getUserPayments', { userId, limit });
  }
}

// Export singleton instance
const subscriptionsServiceInstance = new SubscriptionsService();

// Backward-compatible standalone function exports
export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  return subscriptionsServiceInstance.getSubscriptionByUserId(userId);
}

export async function getAllPlanLimits(): Promise<PlanLimits[]> {
  return subscriptionsServiceInstance.getAllPlanLimits();
}

export async function getPlanLimits(planType: PlanType): Promise<PlanLimits | null> {
  return subscriptionsServiceInstance.getPlanLimits(planType);
}

export async function getUserPlanLimits(userId: string): Promise<PlanLimits> {
  return subscriptionsServiceInstance.getUserPlanLimits(userId);
}

export async function getCurrentUsage(userId: string): Promise<Record<string, number>> {
  return subscriptionsServiceInstance.getCurrentUsage(userId);
}

export async function incrementUsage(
  userId: string,
  metricName: string,
  quantity = 1
): Promise<void> {
  return subscriptionsServiceInstance.incrementUsage(userId, metricName, quantity);
}

export async function checkQuota(
  userId: string,
  metricName: string,
  requiredQuantity = 1
): Promise<boolean> {
  return subscriptionsServiceInstance.checkQuota(userId, metricName, requiredQuantity);
}

export async function getUserInvoices(userId: string, limit = 10) {
  return subscriptionsServiceInstance.getUserInvoices(userId, limit);
}

export async function getUserPayments(userId: string, limit = 10) {
  return subscriptionsServiceInstance.getUserPayments(userId, limit);
}
