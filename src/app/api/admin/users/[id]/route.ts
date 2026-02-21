import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin-users-detail');

export const GET = withAuth(async (_request, context, _auth) => {
  const { id } = await context.params!;

  const supabase = await createClient();

  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !user) {
    return errorResponse('User not found', 404);
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

  return successResponse({
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
  });
}, { roles: ['admin'], rateLimit: 'STANDARD' });
