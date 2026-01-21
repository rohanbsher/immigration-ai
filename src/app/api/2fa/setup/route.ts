import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { setupTwoFactor } from '@/lib/2fa';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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

    const setup = await setupTwoFactor(user.id, user.email || '');

    return NextResponse.json({
      success: true,
      data: {
        qrCodeDataUrl: setup.qrCodeDataUrl,
        secret: setup.secret,
        backupCodes: setup.backupCodes,
      },
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    const message = error instanceof Error ? error.message : 'Failed to setup 2FA';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
