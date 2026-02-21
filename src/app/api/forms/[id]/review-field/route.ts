import { NextRequest } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { auditService } from '@/lib/audit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:forms-review-field');

const reviewFieldSchema = z.object({
  fieldName: z.string().min(1, 'Field name is required'),
  acceptedValue: z.unknown(),
  notes: z.string().optional(),
});

/**
 * POST /api/forms/[id]/review-field
 *
 * Mark a specific AI-filled field as reviewed by an attorney.
 * This is required for low-confidence fields before form filing.
 */
export const POST = withAuth(async (request: NextRequest, context, auth) => {
  const { id } = await context.params!;
  const supabase = await createClient();

  const form = await formsService.getForm(id);

  if (!form) {
    return errorResponse('Form not found', 404);
  }

  // Verify user is the attorney assigned to this case
  const caseData = await casesService.getCase(form.case_id);

  if (!caseData) {
    return errorResponse('Case not found', 404);
  }

  if (caseData.attorney_id !== auth.user.id) {
    return errorResponse('Only the assigned attorney can review form fields', 403);
  }

  // Defense-in-depth: verify case belongs to the attorney's firm
  if (caseData.firm_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('id', auth.user.id)
      .single();

    if (profile && profile.firm_id && profile.firm_id !== caseData.firm_id) {
      log.warn('Firm ID mismatch on form review', {
        userId: auth.user.id,
        caseId: form.case_id,
        userFirmId: profile.firm_id,
        caseFirmId: caseData.firm_id,
      });
      return errorResponse('Access denied', 403);
    }
  }

  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  try {
    const { fieldName, acceptedValue, notes } = reviewFieldSchema.parse(body);

    // Get the AI-filled value for this field
    const aiFilledData = form.ai_filled_data as Record<string, unknown> | null;
    const originalValue = aiFilledData?.[fieldName];

    // Get or initialize reviewed fields data
    const formData = form.form_data as Record<string, unknown>;
    const existingReviewedFields = (formData?.reviewed_fields_data as {
      reviewed_fields: Record<string, unknown>;
    })?.reviewed_fields || {};

    // Create review record
    const reviewRecord = {
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user.id,
      original_value: originalValue,
      accepted_value: acceptedValue,
      notes: notes || null,
    };

    // Update form data with new reviewed field
    const updatedReviewedFields = {
      ...existingReviewedFields,
      [fieldName]: reviewRecord,
    };

    const updatedFormData = {
      ...formData,
      reviewed_fields_data: {
        reviewed_fields: updatedReviewedFields,
      },
      // Also update the actual form field with the accepted value
      [fieldName]: acceptedValue,
    };

    // Update form in database
    const updatedForm = await formsService.updateForm(id, {
      form_data: updatedFormData,
    });

    // Log this review action in the audit trail
    await auditService.log({
      table_name: 'forms',
      record_id: id,
      operation: 'update',
      old_values: {
        [fieldName]: originalValue,
      },
      new_values: {
        [fieldName]: acceptedValue,
      },
      additional_context: {
        action: 'field_review',
        field_name: fieldName,
        ai_original_value: originalValue,
        attorney_accepted_value: acceptedValue,
        review_notes: notes,
        confidence_score: (form.ai_confidence_scores as Record<string, number>)?.[fieldName],
      },
    });

    return successResponse({
      message: `Field "${fieldName}" has been reviewed`,
      reviewRecord,
      updatedForm,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    throw error;
  }
}, { rateLimit: 'SENSITIVE' });
