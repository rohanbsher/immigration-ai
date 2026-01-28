import { NextRequest, NextResponse } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { auditService } from '@/lib/audit';
import { z } from 'zod';

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
export async function POST(
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

    const form = await formsService.getForm(id);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Verify user is the attorney assigned to this case
    const caseData = await casesService.getCase(form.case_id);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (caseData.attorney_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the assigned attorney can review form fields' },
        { status: 403 }
      );
    }

    const body = await request.json();
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
      reviewed_by: user.id,
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

    return NextResponse.json({
      success: true,
      message: `Field "${fieldName}" has been reviewed`,
      reviewRecord,
      updatedForm,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error reviewing form field:', error);
    return NextResponse.json(
      { error: 'Failed to review form field' },
      { status: 500 }
    );
  }
}
