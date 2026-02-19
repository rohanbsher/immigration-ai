import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getStripeClient } from '@/lib/stripe/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin-stats');

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const profile = await serverAuth.getProfile();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.logError('Admin stats error', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
