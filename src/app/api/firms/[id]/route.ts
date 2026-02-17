import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverAuth } from '@/lib/auth';
import { getFirmById, updateFirm, deleteFirm, getUserRole } from '@/lib/db/firms';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { canManageMembers, canDeleteFirm } from '@/types/firms';
import { createLogger } from '@/lib/logger';
import { safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:firms-detail');

const updateFirmSchema = z.object({
  name: z.string().min(2).max(100).optional(),
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
  settings: z.record(z.string(), z.unknown()).optional(),
});

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

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firm = await getFirmById(id);
    if (!firm) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    const userRole = await getUserRole(user.id, id);
    if (!userRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...firm,
        userRole,
      },
    });
  } catch (error) {
    log.logError('Get firm error', error);
    return NextResponse.json(
      { error: 'Failed to fetch firm' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
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

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = await getUserRole(user.id, id);
    if (!userRole || !canManageMembers(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const validation = updateFirmSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const firm = await updateFirm(id, validation.data);

    return NextResponse.json({
      success: true,
      data: firm,
    });
  } catch (error) {
    log.logError('Update firm error', error);
    return NextResponse.json(
      { error: 'Failed to update firm' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, ip);

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

    const userRole = await getUserRole(user.id, id);
    if (!userRole || !canDeleteFirm(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteFirm(id);

    return NextResponse.json({
      success: true,
      message: 'Firm deleted successfully',
    });
  } catch (error) {
    log.logError('Delete firm error', error);
    return NextResponse.json(
      { error: 'Failed to delete firm' },
      { status: 500 }
    );
  }
}
