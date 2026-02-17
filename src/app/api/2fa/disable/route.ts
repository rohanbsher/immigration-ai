import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverAuth } from '@/lib/auth';
import { disableTwoFactor } from '@/lib/2fa';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { safeParseBody } from '@/lib/api/safe-parse-body';

const log = createLogger('api:2fa-disable');

const disableSchema = z.object({
  token: z.string().min(6).max(8),
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

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const validation = disableSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { token } = validation.data;
    const success = await disableTwoFactor(user.id, token);

    if (!success) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        disabled: true,
        message: '2FA has been disabled',
      },
    });
  } catch (error) {
    log.logError('2FA disable error', error);
    return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 });
  }
}
