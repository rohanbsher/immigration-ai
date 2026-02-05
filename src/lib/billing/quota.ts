import { createClient } from '@/lib/supabase/server';
import { getUserPlanLimits } from '@/lib/db/subscriptions';
import { createLogger } from '@/lib/logger';

const logger = createLogger('billing:quota');

/**
 * Supabase/PostgREST error code for "no rows returned" from .single()
 * This is expected when querying for optional records, not a true error.
 * Exported for consistent usage across billing module.
 */
export const POSTGREST_NO_ROWS = 'PGRST116';

export type QuotaMetric = 'cases' | 'documents' | 'ai_requests' | 'storage' | 'team_members';

export interface QuotaCheck {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  message?: string;
}

/**
 * Helper to check if a Supabase error is a "no rows found" error.
 * These are expected for optional queries and should not be thrown.
 */
function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === POSTGREST_NO_ROWS;
}

/**
 * Checks quota for a user against a specific metric.
 */
export async function checkQuota(
  userId: string,
  metric: QuotaMetric,
  requiredAmount = 1
): Promise<QuotaCheck> {
  const limits = await getUserPlanLimits(userId);
  const limit = getLimit(limits, metric);

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

/**
 * Extract limit value from plan limits based on metric.
 */
function getLimit(limits: Awaited<ReturnType<typeof getUserPlanLimits>>, metric: QuotaMetric): number {
  switch (metric) {
    case 'cases':
      return limits.maxCases;
    case 'documents':
      return limits.maxDocumentsPerCase;
    case 'ai_requests':
      return limits.maxAiRequestsPerMonth;
    case 'storage':
      return Math.floor(limits.maxStorageGb * 1024 * 1024 * 1024);
    case 'team_members':
      return limits.maxTeamMembers;
    default:
      throw new Error(`Unknown metric: ${metric}`);
  }
}

async function getCurrentUsage(userId: string, metric: QuotaMetric): Promise<number> {
  const supabase = await createClient();

  switch (metric) {
    case 'cases': {
      const { count, error } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('attorney_id', userId)
        .is('deleted_at', null);

      if (error) {
        throw new Error(`Failed to get case count: ${error.message}`);
      }

      return count || 0;
    }

    case 'ai_requests': {
      const { data: subscription, error: subError } = await supabase
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

      if (subError && !isNoRowsError(subError)) {
        throw new Error(`Failed to get subscription: ${subError.message}`);
      }

      if (!subscription) return 0;

      const { data: usage, error: usageError } = await supabase
        .from('usage_records')
        .select('quantity')
        .eq('subscription_id', subscription.id)
        .eq('metric_name', 'ai_requests')
        .gte('period_start', subscription.current_period_start)
        .lte('period_end', subscription.current_period_end)
        .single();

      if (usageError && !isNoRowsError(usageError)) {
        throw new Error(`Failed to get AI usage: ${usageError.message}`);
      }

      return usage?.quantity || 0;
    }

    case 'documents': {
      // Get max document count in any single case (not total across all cases)
      // This matches the semantic of maxDocumentsPerCase limit
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('id')
        .eq('attorney_id', userId)
        .is('deleted_at', null);

      if (casesError) {
        throw new Error(`Failed to get user cases: ${casesError.message}`);
      }

      if (!cases || cases.length === 0) return 0;

      const { data: docCounts, error: docsError } = await supabase
        .from('documents')
        .select('case_id')
        .in('case_id', cases.map(c => c.id))
        .is('deleted_at', null);

      if (docsError) {
        throw new Error(`Failed to get document counts: ${docsError.message}`);
      }

      if (!docCounts || docCounts.length === 0) return 0;

      // Count per case, return maximum
      const countsByCase = new Map<string, number>();
      for (const doc of docCounts) {
        countsByCase.set(doc.case_id, (countsByCase.get(doc.case_id) || 0) + 1);
      }
      return Math.max(...countsByCase.values(), 0);
    }

    case 'storage': {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('file_size')
        .eq('uploaded_by', userId);

      if (error) {
        throw new Error(`Failed to get storage usage: ${error.message}`);
      }

      if (!documents) return 0;
      return documents.reduce((total, doc) => total + (doc.file_size || 0), 0);
    }

    case 'team_members': {
      const { count, error } = await supabase
        .from('firm_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to get team member count: ${error.message}`);
      }

      return count || 1;
    }

    default:
      return 0;
  }
}

/**
 * Tracks usage for a metered metric (e.g., AI requests).
 * Logs errors but doesn't throw - usage tracking is non-critical
 * and shouldn't block the main operation.
 */
export async function trackUsage(
  userId: string,
  metric: QuotaMetric,
  amount = 1
): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: subscription, error: subError } = await supabase
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

    if (subError && !isNoRowsError(subError)) {
      logger.warn('Failed to get subscription for usage tracking', {
        userId,
        metric,
        error: subError.message,
      });
      return;
    }

    if (!subscription) return;

    const { error: rpcError } = await supabase.rpc('increment_usage', {
      p_subscription_id: subscription.id,
      p_metric_name: metric,
      p_quantity: amount,
    });

    if (rpcError) {
      logger.warn('Failed to increment usage', {
        userId,
        metric,
        subscriptionId: subscription.id,
        error: rpcError.message,
      });
    }
  } catch (err) {
    // Non-critical - log and continue
    logger.warn('Unexpected error in trackUsage', {
      userId,
      metric,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Throws if user has exceeded quota for the given metric.
 */
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

/**
 * Options for enforcing per-case quotas.
 */
export interface EnforceQuotaForCaseOptions {
  /** The case to check quota for */
  caseId: string;
  /** The metric to check (currently only 'documents') */
  metric: 'documents';
  /**
   * The case owner's user ID. If provided, skips the case lookup.
   * IMPORTANT: Caller is responsible for verifying case access before
   * passing this - the function will not validate the case exists.
   */
  attorneyId?: string;
}

/**
 * Enforces per-case document quota before upload.
 *
 * IMPORTANT: This is "soft enforcement" for better UX. The database trigger
 * check_document_quota() provides "hard enforcement" that prevents race
 * conditions (e.g., two concurrent uploads). This function exists to give
 * users a friendly error message before hitting the database constraint.
 *
 * @throws QuotaExceededError if case has reached document limit
 * @throws Error if case not found or DB query fails
 */
export async function enforceQuotaForCase(
  caseId: string,
  metric: 'documents',
  attorneyId?: string
): Promise<void> {
  const supabase = await createClient();

  let ownerId: string;

  if (attorneyId) {
    // Caller provided attorneyId - trust it (they've already verified access)
    ownerId = attorneyId;
  } else {
    // Look up the case to get the owner
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('attorney_id')
      .eq('id', caseId)
      .single();

    if (caseError && !isNoRowsError(caseError)) {
      throw new Error(`Failed to get case: ${caseError.message}`);
    }

    if (!caseData) {
      throw new Error('Case not found');
    }

    ownerId = caseData.attorney_id;
  }

  // Get plan limits
  const limits = await getUserPlanLimits(ownerId);
  const limit = limits.maxDocumentsPerCase;

  if (limit === -1) return; // Unlimited

  // Count docs in THIS specific case
  const { count, error } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to check document quota: ${error.message}`);
  }

  const current = count || 0;
  if (current >= limit) {
    throw new QuotaExceededError('documents', limit, current);
  }
}
