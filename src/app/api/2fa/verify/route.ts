import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverAuth } from '@/lib/auth';
import { verifyAndEnableTwoFactor, verifyTwoFactorToken } from '@/lib/2fa';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const verifySchema = z.object({
  token: z.string().min(6).max(8),
  isSetup: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.AUTH, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { token, isSetup } = validation.data;
    let isValid: boolean;

    if (isSetup) {
      isValid = await verifyAndEnableTwoFactor(user.id, token);
    } else {
      isValid = await verifyTwoFactorToken(user.id, token);
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        verified: true,
        message: isSetup ? '2FA has been enabled' : 'Verification successful',
      },
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
