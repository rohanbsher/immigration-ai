import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cancelSubscription, getUserSubscription } from '@/lib/stripe';
import { serverAuth } from '@/lib/auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const cancelSchema = z.object({
  immediately: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, ip);

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

    const body = await request.json().catch(() => ({}));
    const validation = cancelSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const subscription = await getUserSubscription(user.id);

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    const { immediately } = validation.data;

    const updatedSubscription = await cancelSubscription(
      subscription.stripe_subscription_id,
      immediately
    );

    // Access the current_period_end from the subscription object
    const currentPeriodEnd = 'current_period_end' in updatedSubscription
      ? new Date((updatedSubscription as { current_period_end: number }).current_period_end * 1000).toISOString()
      : null;

    return NextResponse.json({
      success: true,
      data: {
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
