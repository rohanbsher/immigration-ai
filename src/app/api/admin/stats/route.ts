import { withAuth, successResponse } from '@/lib/auth/api-helpers';
import { createClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin-stats');

export const GET = withAuth(async (_request, _context, auth) => {
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalUsersResult,
    newUsersThisMonthResult,
    newUsersLastMonthResult,
    totalCasesResult,
    activeCasesResult,
    totalDocumentsResult,
    totalSubscriptionsResult,
    activeSubscriptionsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString()),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfLastMonth.toISOString())
      .lt('created_at', startOfMonth.toISOString()),
    supabase.from('cases').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('status', 'in', '("completed","closed")'),
    supabase.from('documents').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
    supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['trialing', 'active']),
  ]);

  const totalUsers = totalUsersResult.count || 0;
  const newUsersThisMonth = newUsersThisMonthResult.count || 0;
  const newUsersLastMonth = newUsersLastMonthResult.count || 0;
  const userGrowth = newUsersLastMonth > 0
    ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
    : newUsersThisMonth > 0 ? 100 : 0;

  // Calculate MRR from active Stripe subscriptions (bounded to avoid timeout)
  let mrr = 0;
  // MVP: MRR growth calculation not yet implemented — null tells the
  // frontend to display "N/A" instead of a misleading "0%".
  const mrrGrowth = null;
  const stripe = getStripeClient();
  if (stripe) {
    try {
      // Auto-paginate through ALL active subscriptions.
      // At scale, this should be replaced with a cached MRR value updated via webhooks.
      for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
        const item = sub.items.data[0];
        if (!item?.price?.unit_amount) continue;
        const interval = item.price.recurring?.interval;
        const amount = item.price.unit_amount;
        mrr += interval === 'year' ? Math.round(amount / 12) : amount;
      }
    } catch (error) {
      log.logError('Failed to calculate MRR from Stripe', error);
    }
  }

  const stats = {
    totalUsers,
    newUsersThisMonth,
    userGrowth,
    totalCases: totalCasesResult.count || 0,
    activeCases: activeCasesResult.count || 0,
    totalDocuments: totalDocumentsResult.count || 0,
    totalSubscriptions: totalSubscriptionsResult.count || 0,
    activeSubscriptions: activeSubscriptionsResult.count || 0,
    mrr,
    mrrGrowth,
  };

  return successResponse(stats);
}, { roles: ['admin'], rateLimit: 'STANDARD' });
