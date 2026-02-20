import { NextRequest, NextResponse } from 'next/server';
import { casesService, activitiesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { sendCaseUpdateEmail } from '@/lib/email/notifications';
import { standardRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { VISA_TYPES, CASE_STATUSES } from '@/lib/validation';
import { safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:case');

const updateCaseSchema = z.object({
  visa_type: z.enum(VISA_TYPES, { message: 'Invalid visa type' }).optional(),
  status: z.enum(CASE_STATUSES, { message: 'Invalid case status' }).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priority_date: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  expected_updated_at: z.string().optional(),
});

/**
 * Verify that the current user can access this case.
 * Returns the case data if accessible, null otherwise.
 * Also returns the user's role for permission checks.
 */
async function getCaseWithAccess(userId: string, caseId: string): Promise<{
  case: Awaited<ReturnType<typeof casesService.getCase>>;
  canModify: boolean;
} | null> {
  const caseData = await casesService.getCase(caseId);

  if (!caseData) {
    return null;
  }

  // Check if user is the attorney or client on this case
  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;

  if (!isAttorney && !isClient) {
    return null;
  }

  return {
    case: caseData,
    canModify: isAttorney, // Only attorneys can modify cases
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const accessResult = await getCaseWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json(accessResult.case);
  } catch (error) {
    log.logError('Error fetching case', error);
    return NextResponse.json(
      { error: 'Failed to fetch case' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const accessResult = await getCaseWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!accessResult.canModify) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const validatedData = updateCaseSchema.parse(body);

    // Optimistic locking: reject stale updates when expected_updated_at is provided
    const caseData = accessResult.case;
    if (validatedData.expected_updated_at && caseData) {
      const currentUpdatedAt = caseData.updated_at;
      if (currentUpdatedAt && validatedData.expected_updated_at !== currentUpdatedAt) {
        return NextResponse.json(
          {
            error: 'This case has been modified by another user. Please refresh and try again.',
            code: 'CONFLICT',
            current_updated_at: currentUpdatedAt,
          },
          { status: 409 }
        );
      }
    }

    // Strip expected_updated_at before passing to the service (not a real column)
    const { expected_updated_at: _unused, ...updatePayload } = validatedData;

    // Track if status changed for email notification
    const previousStatus = caseData?.status;
    const statusChanged = updatePayload.status && updatePayload.status !== previousStatus;

    const updatedCase = await casesService.updateCase(id, updatePayload as Parameters<typeof casesService.updateCase>[1]);

    // Send email notification on status change (fire and forget)
    if (statusChanged && validatedData.status) {
      sendCaseUpdateEmail(
        id,
        'status_change',
        `Case status changed from "${previousStatus}" to "${validatedData.status}"`,
        user.id
      ).catch((err) => {
        log.logError('Failed to send case update email', err);
      });
    }

    // Log activity (fire and forget)
    if (statusChanged && validatedData.status) {
      activitiesService.logStatusChanged(id, previousStatus!, validatedData.status, user.id).catch(err => {
        log.warn('Activity log failed', { error: err });
      });
    } else {
      const changes = Object.keys(updatePayload).join(', ');
      activitiesService.logCaseUpdated(id, `Updated: ${changes}`, user.id).catch(err => {
        log.warn('Activity log failed', { error: err });
      });
    }

    return NextResponse.json(updatedCase);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    log.logError('Error updating case', error);
    return NextResponse.json(
      { error: 'Failed to update case' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check (using sensitive for destructive actions)
    const { sensitiveRateLimiter } = await import('@/lib/rate-limit');
    const rateLimitResult = await sensitiveRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const accessResult = await getCaseWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!accessResult.canModify) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await casesService.deleteCase(id);

    return NextResponse.json({ message: 'Case deleted successfully' });
  } catch (error) {
    log.logError('Error deleting case', error);
    return NextResponse.json(
      { error: 'Failed to delete case' },
      { status: 500 }
    );
  }
}
