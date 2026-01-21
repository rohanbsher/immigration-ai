import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverAuth } from '@/lib/auth';
import { regenerateBackupCodes } from '@/lib/2fa';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const regenerateSchema = z.object({
  token: z.string().min(6).max(6),
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

    const body = await request.json();
    const validation = regenerateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { token } = validation.data;
    const backupCodes = await regenerateBackupCodes(user.id, token);

    return NextResponse.json({
      success: true,
      data: {
        backupCodes,
        message: 'New backup codes generated. Previous codes are now invalid.',
      },
    });
  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    const message = error instanceof Error ? error.message : 'Failed to regenerate backup codes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
