import { NextResponse } from 'next/server';
import { withAuth, errorResponse, verifyFormAccess } from '@/lib/auth/api-helpers';
import { formsService } from '@/lib/db';
import { analyzeFormForReview, getReviewSummary } from '@/lib/form-validation';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:forms-review-status');

/**
 * GET /api/forms/[id]/review-status
 *
 * Returns the current review status of AI-filled fields in a form,
 * including which fields require attorney review before filing.
 */
export const GET = withAuth(async (_request, context, auth) => {
  try {
    const { id } = await context.params!;

    const form = await formsService.getForm(id);
    if (!form) {
      return errorResponse('Form not found', 404);
    }

    const formAccess = await verifyFormAccess(auth.user.id, id);
    if (!formAccess.success) {
      return errorResponse(formAccess.error, formAccess.status);
    }

    // Analyze form for review requirements
    const reviewStatus = analyzeFormForReview(
      form.form_data as Record<string, unknown>,
      form.ai_filled_data as Record<string, unknown> | null,
      form.ai_confidence_scores as Record<string, number> | null,
      (form.form_data as Record<string, unknown>)?.reviewed_fields_data as {
        reviewed_fields: Record<string, {
          reviewed_at: string;
          reviewed_by: string;
          original_value: unknown;
          accepted_value: unknown;
        }>;
      } | null
    );

    // Add form metadata
    reviewStatus.formId = id;
    reviewStatus.formType = form.form_type;

    return NextResponse.json({
      ...reviewStatus,
      summary: getReviewSummary(reviewStatus),
      formStatus: form.status,
    });
  } catch (error) {
    log.logError('Error getting form review status', error);
    return errorResponse('Failed to get review status', 500);
  }
});
