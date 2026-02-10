import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { schemas } from '@/lib/validation';

const log = createLogger('api:admin-users-suspend');

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
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

    const profile = await serverAuth.getProfile();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const uuidResult = schemas.uuid.safeParse(id);
    if (!uuidResult.success) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    if (id === profile.id) {
      return NextResponse.json(
        { error: 'Cannot suspend your own account' },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(id);
    if (getUserError || !targetUser?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { error: banError } = await adminClient.auth.admin.updateUserById(id, {
      ban_duration: '876000h',
    });

    if (banError) {
      log.logError('Failed to suspend user', { userId: id, error: banError.message });
      return NextResponse.json(
        { error: 'Failed to suspend user' },
        { status: 500 }
      );
    }

    log.info('User suspended', { userId: id, adminId: profile.id });

    return NextResponse.json({
      success: true,
      message: 'User suspended',
    });
  } catch (error) {
    log.logError('Admin suspend user error', error);
    return NextResponse.json(
      { error: 'Failed to suspend user' },
      { status: 500 }
    );
  }
}
