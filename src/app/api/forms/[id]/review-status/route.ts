import { NextRequest, NextResponse } from 'next/server';
import { formsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { analyzeFormForReview, getReviewSummary } from '@/lib/form-validation';

/**
 * GET /api/forms/[id]/review-status
 *
 * Returns the current review status of AI-filled fields in a form,
 * including which fields require attorney review before filing.
 */
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

    const form = await formsService.getForm(id);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Verify user has access to this form via its case
    const caseData = await casesService.getCase(form.case_id);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const isAttorney = caseData.attorney_id === user.id;
    const isClient = caseData.client_id === user.id;

    if (!isAttorney && !isClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    console.error('Error getting form review status:', error);
    return NextResponse.json(
      { error: 'Failed to get review status' },
      { status: 500 }
    );
  }
}
