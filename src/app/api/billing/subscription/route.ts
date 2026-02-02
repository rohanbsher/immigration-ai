import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { getSubscriptionByUserId, getUserPlanLimits, getAllPlanLimits } from '@/lib/db/subscriptions';
import { getCustomerWithSubscription } from '@/lib/stripe';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing-subscription');

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [subscription, customerData, limits, allPlans] = await Promise.all([
      getSubscriptionByUserId(user.id),
      getCustomerWithSubscription(user.id),
      getUserPlanLimits(user.id),
      getAllPlanLimits(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        subscription: subscription
          ? {
              id: subscription.id,
              planType: subscription.planType,
              status: subscription.status,
              billingPeriod: subscription.billingPeriod,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              trialEnd: subscription.trialEnd,
            }
          : null,
        customer: customerData
          ? {
              customerId: customerData.customerId,
              email: customerData.email,
              name: customerData.name,
            }
          : null,
        limits,
        availablePlans: allPlans,
      },
    });
  } catch (error) {
    log.logError('Subscription fetch error', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
