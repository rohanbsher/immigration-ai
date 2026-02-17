import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:gdpr-delete');

const deleteRequestSchema = z.object({
  reason: z.string().optional(),
});

const cancelRequestSchema = z.object({
  reason: z.string().optional(),
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

    const supabase = await createClient();

    const { data: request_, error } = await supabase
      .from('gdpr_deletion_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single();

    if (error && error.code !== 'PGRST116') {
      log.logError('Failed to fetch deletion request', error);
      return NextResponse.json(
        { error: 'Failed to fetch deletion request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: request_ || null,
    });
  } catch (error) {
    log.logError('GDPR delete request error', error);
    return NextResponse.json(
      { error: 'Failed to fetch deletion request' },
      { status: 500 }
    );
  }
}

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
    const body = parsed.data as Record<string, unknown>;
    const validation = deleteRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: deleteRequest, error } = await supabase.rpc('request_account_deletion', {
      p_user_id: user.id,
      p_reason: validation.data.reason || null,
      p_grace_period_days: 30,
    });

    if (error) {
      if (error.message.includes('already pending')) {
        return NextResponse.json(
          { error: 'A deletion request is already pending' },
          { status: 400 }
        );
      }
      log.logError('Failed to create deletion request', error);
      return NextResponse.json(
        { error: 'Failed to request deletion' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: deleteRequest.id,
        scheduledFor: deleteRequest.scheduled_for,
        message: 'Your account is scheduled for deletion. You have 30 days to cancel this request.',
      },
    });
  } catch (error) {
    log.logError('GDPR delete request error', error);
    return NextResponse.json({ error: 'Failed to request deletion' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
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

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data as Record<string, unknown>;
    const validation = cancelRequestSchema.safeParse(body);

    const supabase = await createClient();

    const { data: cancelled, error } = await supabase.rpc('cancel_deletion_request', {
      p_user_id: user.id,
      p_reason: validation.success ? validation.data.reason : null,
    });

    if (error) {
      log.logError('Failed to cancel deletion request', error);
      return NextResponse.json(
        { error: 'Failed to cancel deletion' },
        { status: 500 }
      );
    }

    if (!cancelled) {
      return NextResponse.json(
        { error: 'No pending deletion request found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        cancelled: true,
        message: 'Deletion request has been cancelled',
      },
    });
  } catch (error) {
    log.logError('GDPR cancel delete error', error);
    return NextResponse.json({ error: 'Failed to cancel deletion' }, { status: 500 });
  }
}
