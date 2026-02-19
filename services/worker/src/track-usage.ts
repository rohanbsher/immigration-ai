/**
 * Worker-compatible usage tracking.
 *
 * The main app's trackUsage (@/lib/billing/quota) depends on Next.js cookies
 * via createClient(), which is unavailable in the worker. This module
 * reimplements the same logic using the worker's admin Supabase client.
 */

import { createLogger } from '@/lib/logger';
import { getWorkerSupabase } from './supabase';

const logger = createLogger('worker:usage');

/**
 * Track AI request usage for a user.
 * Non-critical: logs errors but never throws.
 */
export async function trackUsage(
  userId: string,
  metric: string,
  amount = 1
): Promise<void> {
  try {
    const supabase = getWorkerSupabase();

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

    if (subError) {
      // PGRST116 = no rows, expected for users without subscriptions
      if (subError.code !== 'PGRST116') {
        logger.warn('Failed to get subscription for usage tracking', {
          userId,
          metric,
          error: subError.message,
        });
      }
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
    logger.warn('Unexpected error in trackUsage', {
      userId,
      metric,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
