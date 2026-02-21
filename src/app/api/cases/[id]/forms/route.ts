import { formsService, casesService, activitiesService } from '@/lib/db';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { FORM_TYPES } from '@/lib/validation';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:case-forms');

const createFormSchema = z.object({
  form_type: z.enum(FORM_TYPES, { message: 'Invalid form type' }),
  form_data: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Verify user has access to this case (is attorney or client).
 * Returns null if no access, otherwise returns role info.
 */
async function verifyCaseAccess(userId: string, caseId: string): Promise<{ hasAccess: boolean; isAttorney: boolean } | null> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return null;
  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;
  if (!isAttorney && !isClient) return null;
  return { hasAccess: true, isAttorney };
}

export const GET = withAuth(async (request, context, auth) => {
  const { id: caseId } = await context.params!;

  // Verify user has access to this case
  const access = await verifyCaseAccess(auth.user.id, caseId);
  if (!access) {
    return errorResponse('Forbidden', 403);
  }

  const forms = await formsService.getFormsByCase(caseId);

  return successResponse(forms);
}, { rateLimit: 'STANDARD' });

export const POST = withAuth(async (request, context, auth) => {
  const { id: caseId } = await context.params!;

  // Verify user has access to this case
  const access = await verifyCaseAccess(auth.user.id, caseId);
  if (!access) {
    return errorResponse('Forbidden', 403);
  }

  // Only the case's attorney can create forms
  if (!access.isAttorney) {
    return errorResponse('Only the case attorney can create forms', 403);
  }

  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const parseResult = createFormSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse(parseResult.error.issues[0].message, 400);
  }
  const validatedData = parseResult.data;

  const form = await formsService.createForm({
    case_id: caseId,
    form_type: validatedData.form_type as Parameters<typeof formsService.createForm>[0]['form_type'],
    form_data: validatedData.form_data,
  });

  // Log activity (fire and forget)
  activitiesService.logFormCreated(caseId, validatedData.form_type, form.id, auth.user.id).catch(err => {
    log.warn('Activity log failed', { error: err });
  });

  return successResponse(form, 201);
}, { rateLimit: 'STANDARD' });
