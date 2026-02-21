import { NextRequest } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { z } from 'zod';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';

const reviewSchema = z.object({
  notes: z.string().optional().default(''),
});

export const POST = withAuth(async (request: NextRequest, context, auth) => {
  const { id } = await context.params!;

  // Get the form
  const form = await formsService.getForm(id);

  if (!form) {
    return errorResponse('Form not found', 404);
  }

  // Get the case to verify attorney has access
  const caseData = await casesService.getCase(form.case_id);

  if (!caseData) {
    return errorResponse('Case not found', 404);
  }

  // Only the attorney assigned to this case can review forms
  if (caseData.attorney_id !== auth.user.id) {
    return errorResponse('Only the assigned attorney can review forms', 403);
  }

  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  try {
    const { notes } = reviewSchema.parse(body);
    const reviewedForm = await formsService.reviewForm(id, notes, auth.user.id);
    return successResponse(reviewedForm);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    throw error;
  }
}, { rateLimit: 'STANDARD' });
