import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/email';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';
import { safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:notification-preferences');

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

    const preferences = await getNotificationPreferences(user.id);

    return NextResponse.json({ success: true, data: preferences });
  } catch (error) {
    log.logError('Failed to fetch notification preferences', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

const updateSchema = z.object({
  email_case_updates: z.boolean().optional(),
  email_deadline_reminders: z.boolean().optional(),
  email_document_uploads: z.boolean().optional(),
  email_form_updates: z.boolean().optional(),
  email_team_updates: z.boolean().optional(),
  email_billing_updates: z.boolean().optional(),
  email_marketing: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
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
    const validatedData = updateSchema.parse(body);

    const preferences = await updateNotificationPreferences(user.id, validatedData);

    return NextResponse.json({ success: true, data: preferences });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    log.logError('Failed to update notification preferences', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
