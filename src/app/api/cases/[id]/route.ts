import { casesService, activitiesService } from '@/lib/db';
import { z } from 'zod';
import { sendCaseUpdateEmail } from '@/lib/email/notifications';
import { createLogger } from '@/lib/logger';
import { VISA_TYPES, CASE_STATUSES } from '@/lib/validation';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';

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

export const GET = withAuth(async (request, context, auth) => {
  const { id } = await context.params!;

  const accessResult = await getCaseWithAccess(auth.user.id, id);

  if (!accessResult) {
    return errorResponse('Case not found', 404);
  }

  return successResponse(accessResult.case);
}, { rateLimit: 'STANDARD' });

export const PATCH = withAuth(async (request, context, auth) => {
  const { id } = await context.params!;

  const accessResult = await getCaseWithAccess(auth.user.id, id);

  if (!accessResult) {
    return errorResponse('Case not found', 404);
  }

  if (!accessResult.canModify) {
    return errorResponse('Forbidden', 403);
  }

  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const parseResult = updateCaseSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse(parseResult.error.issues[0].message, 400);
  }
  const validatedData = parseResult.data;

  // Optimistic locking: reject stale updates when expected_updated_at is provided
  const caseData = accessResult.case;
  if (validatedData.expected_updated_at && caseData) {
    const currentUpdatedAt = caseData.updated_at;
    if (currentUpdatedAt && validatedData.expected_updated_at !== currentUpdatedAt) {
      return errorResponse(
        'This case has been modified by another user. Please refresh and try again.',
        409
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
      auth.user.id
    ).catch((err) => {
      log.logError('Failed to send case update email', err);
    });
  }

  // Log activity (fire and forget)
  if (statusChanged && validatedData.status) {
    activitiesService.logStatusChanged(id, previousStatus!, validatedData.status, auth.user.id).catch(err => {
      log.warn('Activity log failed', { error: err });
    });
  } else {
    const changes = Object.keys(updatePayload).join(', ');
    activitiesService.logCaseUpdated(id, `Updated: ${changes}`, auth.user.id).catch(err => {
      log.warn('Activity log failed', { error: err });
    });
  }

  return successResponse(updatedCase);
}, { rateLimit: 'STANDARD' });

export const DELETE = withAuth(async (request, context, auth) => {
  const { id } = await context.params!;

  const accessResult = await getCaseWithAccess(auth.user.id, id);

  if (!accessResult) {
    return errorResponse('Case not found', 404);
  }

  if (!accessResult.canModify) {
    return errorResponse('Forbidden', 403);
  }

  await casesService.deleteCase(id);

  return successResponse({ message: 'Case deleted successfully' });
}, { rateLimit: 'SENSITIVE' });
