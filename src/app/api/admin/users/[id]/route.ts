import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin-users-detail');

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
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

    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [casesResult, subscriptionResult] = await Promise.all([
      supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .or(`attorney_id.eq.${id},client_id.eq.${id}`)
        .is('deleted_at', null),
      supabase
        .from('subscriptions')
        .select(`
          *,
          customers!inner (user_id)
        `)
        .eq('customers.user_id', id)
        .in('status', ['trialing', 'active'])
        .single(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        phone: user.phone,
        mfaEnabled: user.mfa_enabled,
        avatarUrl: user.avatar_url,
        barNumber: user.bar_number,
        firmName: user.firm_name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        casesCount: casesResult.count || 0,
        subscription: subscriptionResult.data
          ? {
              planType: subscriptionResult.data.plan_type,
              status: subscriptionResult.data.status,
              currentPeriodEnd: subscriptionResult.data.current_period_end,
            }
          : null,
      },
    });
  } catch (error) {
    log.logError('Admin user detail error', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
