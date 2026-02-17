import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverAuth } from '@/lib/auth';
import { createFirm, getUserFirms } from '@/lib/db/firms';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:firms');

const createFirmSchema = z.object({
  name: z.string().min(2).max(100),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  phone: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

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

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firms = await getUserFirms(user.id);

    return NextResponse.json({
      success: true,
      data: firms,
    });
  } catch (error) {
    log.logError('Get firms error', error);
    return NextResponse.json(
      { error: 'Failed to fetch firms' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
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
    const validation = createFirmSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const firm = await createFirm(validation.data, user.id);

    return NextResponse.json({
      success: true,
      data: firm,
    }, { status: 201 });
  } catch (error) {
    log.logError('Create firm error', error);
    return NextResponse.json(
      { error: 'Failed to create firm' },
      { status: 500 }
    );
  }
}
