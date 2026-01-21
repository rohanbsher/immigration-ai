import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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

    const { data: profile } = await serverAuth.getProfile();
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

    const stats = {
      totalUsers,
      newUsersThisMonth,
      userGrowth,
      totalCases: totalCasesResult.count || 0,
      activeCases: activeCasesResult.count || 0,
      totalDocuments: totalDocumentsResult.count || 0,
      totalSubscriptions: totalSubscriptionsResult.count || 0,
      activeSubscriptions: activeSubscriptionsResult.count || 0,
      mrr: 0,
      mrrGrowth: 0,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
