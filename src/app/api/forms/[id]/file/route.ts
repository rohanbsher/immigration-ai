import { NextRequest } from 'next/server';
import { formsService } from '@/lib/db';
import { validateFormReadyForFiling } from '@/lib/form-validation';
import { createLogger } from '@/lib/logger';
import {
  withAuth,
  verifyFormAccess,
  errorResponse,
  successResponse,
} from '@/lib/auth/api-helpers';

const log = createLogger('api:forms-file');

export const POST = withAuth(
  async (request: NextRequest, context, auth) => {
    const { id } = await context.params!;

    // Verify the attorney owns the case this form belongs to
    const formAccess = await verifyFormAccess(auth.user.id, id);
    if (!formAccess.success) {
      return errorResponse(formAccess.error, formAccess.status);
    }
    if (!formAccess.access.isAttorney) {
      return errorResponse('Only the case attorney can file forms', 403);
    }

    // Check if form is approved before filing
    const form = await formsService.getForm(id);

    if (!form) {
      return errorResponse('Form not found', 404);
    }

    if (form.status !== 'approved') {
      return errorResponse('Form must be approved before filing', 400);
    }

    // CRITICAL: Validate that all low-confidence AI fields have been reviewed
    const filingValidation = validateFormReadyForFiling(
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

    if (!filingValidation.isReady) {
      log.warn('Form filing blocked due to unreviewed fields', {
        formId: id,
        errors: filingValidation.errors,
      });

      return errorResponse(
        'Form cannot be filed until all required fields are reviewed',
        422,
        {
          unreviewedFields: filingValidation.errors,
          message: 'Low-confidence AI-filled fields and sensitive fields must be reviewed by an attorney before filing.',
        }
      );
    }

    const filedForm = await formsService.markAsFiled(id);

    return successResponse(filedForm);
  },
  { rateLimit: 'SENSITIVE', roles: ['attorney'] }
);
