import { createClient } from '@/lib/supabase/server';
import { getUserPlanLimits } from '@/lib/db/subscriptions';

export type QuotaMetric = 'cases' | 'documents' | 'ai_requests' | 'storage' | 'team_members';

export interface QuotaCheck {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  message?: string;
}

export async function checkQuota(
  userId: string,
  metric: QuotaMetric,
  requiredAmount = 1
): Promise<QuotaCheck> {
  const limits = await getUserPlanLimits(userId);
  let limit: number;

  switch (metric) {
    case 'cases':
      limit = limits.maxCases;
      break;
    case 'documents':
      limit = limits.maxDocumentsPerCase;
      break;
    case 'ai_requests':
      limit = limits.maxAiRequestsPerMonth;
      break;
    case 'storage':
      limit = Math.floor(limits.maxStorageGb * 1024 * 1024 * 1024);
      break;
    case 'team_members':
      limit = limits.maxTeamMembers;
      break;
    default:
      throw new Error(`Unknown metric: ${metric}`);
  }

  if (limit === -1) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      remaining: -1,
      isUnlimited: true,
    };
  }

  const current = await getCurrentUsage(userId, metric);
  const remaining = Math.max(0, limit - current);
  const allowed = current + requiredAmount <= limit;

  return {
    allowed,
    current,
    limit,
    remaining,
    isUnlimited: false,
    message: allowed
      ? undefined
      : `You have reached your ${metric.replace('_', ' ')} limit. Please upgrade your plan to continue.`,
  };
}

async function getCurrentUsage(userId: string, metric: QuotaMetric): Promise<number> {
  const supabase = await createClient();

  switch (metric) {
    case 'cases': {
      const { count } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('attorney_id', userId)
        .is('deleted_at', null);
      return count || 0;
    }

    case 'ai_requests': {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select(`
          id,
          current_period_start,
          current_period_end,
          customers!inner (user_id)
        `)
        .eq('customers.user_id', userId)
        .in('status', ['trialing', 'active'])
        .single();

      if (!subscription) return 0;

      const { data: usage } = await supabase
        .from('usage_records')
        .select('quantity')
        .eq('subscription_id', subscription.id)
        .eq('metric_name', 'ai_requests')
        .gte('period_start', subscription.current_period_start)
        .lte('period_end', subscription.current_period_end)
        .single();

      return usage?.quantity || 0;
    }

    case 'storage': {
      const { data: documents } = await supabase
        .from('documents')
        .select('file_size')
        .eq('uploaded_by', userId);

      if (!documents) return 0;
      return documents.reduce((total, doc) => total + (doc.file_size || 0), 0);
    }

    case 'team_members': {
      const { count } = await supabase
        .from('firm_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count || 1;
    }

    default:
      return 0;
  }
}

export async function trackUsage(
  userId: string,
  metric: QuotaMetric,
  amount = 1
): Promise<void> {
  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select(`
      id,
      current_period_start,
      current_period_end,
      customers!inner (user_id)
    `)
    .eq('customers.user_id', userId)
    .in('status', ['trialing', 'active'])
    .single();

  if (!subscription) return;

  await supabase.rpc('increment_usage', {
    p_subscription_id: subscription.id,
    p_metric_name: metric,
    p_quantity: amount,
  });
}

export async function enforceQuota(
  userId: string,
  metric: QuotaMetric,
  requiredAmount = 1
): Promise<void> {
  const check = await checkQuota(userId, metric, requiredAmount);

  if (!check.allowed) {
    throw new QuotaExceededError(metric, check.limit, check.current);
  }
}

export class QuotaExceededError extends Error {
  constructor(
    public metric: QuotaMetric,
    public limit: number,
    public current: number
  ) {
    super(`Quota exceeded for ${metric}: ${current}/${limit}`);
    this.name = 'QuotaExceededError';
  }
}
