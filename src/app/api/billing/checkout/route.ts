import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession, type PlanType, type BillingPeriod } from '@/lib/stripe';
import { serverAuth } from '@/lib/auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const checkoutSchema = z.object({
  planType: z.enum(['pro', 'enterprise']),
  billingPeriod: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { planType, billingPeriod, successUrl, cancelUrl } = validation.data;
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';

    const session = await createCheckoutSession({
      userId: user.id,
      planType: planType as PlanType,
      billingPeriod: billingPeriod as BillingPeriod,
      successUrl: successUrl || `${origin}/dashboard/settings/billing?success=true`,
      cancelUrl: cancelUrl || `${origin}/dashboard/settings/billing?canceled=true`,
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
