import { NextRequest, NextResponse } from 'next/server';
import { formsService, documentsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import {
  autofillForm,
  FormAutofillResult,
  DocumentAnalysisResult,
  ExtractedField,
} from '@/lib/ai';
import { aiRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { enforceQuota, trackUsage, QuotaExceededError } from '@/lib/billing/quota';
import type { FormStatus } from '@/types';
import { logAIRequest } from '@/lib/audit/ai-audit';
import { requireAiConsent } from '@/lib/auth/api-helpers';

const log = createLogger('api:forms-autofill');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id = 'unknown';
  let previousStatus: FormStatus = 'draft';

  try {
    id = (await params).id;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // AI consent check
    const consentError = await requireAiConsent(user.id);
    if (consentError) return consentError;

    // Rate limiting check for AI endpoints (10 requests per hour)
    const rateLimitResult = await aiRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Quota enforcement
    try {
      await enforceQuota(user.id, 'ai_requests');
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return NextResponse.json(
          { error: 'AI request limit reached. Please upgrade your plan.', code: 'QUOTA_EXCEEDED' },
          { status: 402 }
        );
      }
      throw error;
    }

    // Get the form
    const form = await formsService.getForm(id);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Get the case for context
    const caseData = await casesService.getCase(form.case_id);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Authorization check - only attorney can trigger autofill
    if (caseData.attorney_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Atomic autofill lock: uses DB advisory lock to serialize concurrent
    // autofill requests per form. Also handles stuck form recovery (>5 min).
    const { data: lockResult, error: lockError } = await supabase.rpc(
      'try_start_form_autofill',
      { p_form_id: id }
    );

    // Handle both single-row and array returns from RPC
    const lockRow = Array.isArray(lockResult) ? lockResult[0] : lockResult;

    if (lockError || !lockRow?.acquired) {
      const currentStatus = lockRow?.current_status || 'unknown';
      log.info('Form autofill lock not acquired', { formId: id, currentStatus });
      return NextResponse.json(
        { error: currentStatus === 'autofilling'
            ? 'Form autofill is already in progress. Please try again later.'
            : `Form cannot be autofilled in its current state (${currentStatus}).` },
        { status: 409 }
      );
    }

    // Use the status returned by the RPC, not the pre-lock read.
    // The RPC may have recovered a stuck form (autofilling → draft),
    // so the pre-lock form.status would be stale.
    previousStatus = (lockRow.current_status as FormStatus) || form.status;

    // Get all analyzed documents for the case
    const documents = await documentsService.getDocumentsByCase(form.case_id);
    const analyzedDocuments = documents.filter(
      (doc) => doc.status === 'analyzed' && doc.ai_extracted_data
    );

    if (analyzedDocuments.length === 0) {
      // Reset via RPC (acquires advisory lock, checks auth, bypasses RLS)
      try {
        await supabase.rpc('cancel_form_autofill', {
          p_form_id: id,
          p_target_status: previousStatus,
        });
      } catch (resetErr) {
        log.logError('Failed to reset form status after no-docs check', resetErr, { formId: id });
      }
      return NextResponse.json(
        {
          error: 'No analyzed documents available',
          message: 'Please analyze some documents before attempting to autofill the form.',
        },
        { status: 400 }
      );
    }

    // Convert document data to the format expected by the AI service
    const documentAnalyses: DocumentAnalysisResult[] = analyzedDocuments.map(
      (doc) => {
        const extractedData =
          (doc.ai_extracted_data != null &&
            typeof doc.ai_extracted_data === 'object' &&
            !Array.isArray(doc.ai_extracted_data))
            ? (doc.ai_extracted_data as Record<string, unknown>)
            : {};
        const extractedFields: ExtractedField[] = [];

        // Convert stored data back to ExtractedField format
        for (const [key, value] of Object.entries(extractedData)) {
          // Skip internal fields
          if (key.startsWith('_')) continue;

          const fieldData = value as {
            value?: string;
            confidence?: number;
            requires_verification?: boolean;
            source_location?: string;
          };

          extractedFields.push({
            field_name: key,
            value: fieldData.value || null,
            confidence: fieldData.confidence || 0,
            requires_verification: fieldData.requires_verification || false,
            source_location: fieldData.source_location,
          });
        }

        return {
          document_type: doc.document_type,
          extracted_fields: extractedFields,
          overall_confidence: doc.ai_confidence_score || 0,
          processing_time_ms: 0,
        };
      }
    );

    let autofillResult: FormAutofillResult;

    try {
      // Generate autofill suggestions using AI
      autofillResult = await autofillForm({
        formType: form.form_type,
        caseId: form.case_id,
        documentAnalyses,
        existingFormData:
          (form.form_data != null &&
            typeof form.form_data === 'object' &&
            !Array.isArray(form.form_data))
            ? (form.form_data as Record<string, string>)
            : {},
        visaType: caseData.visa_type,
      });
    } catch (aiError) {
      log.logError('AI autofill error', aiError);
      // Reset via RPC (acquires advisory lock, checks auth, bypasses RLS)
      try {
        await supabase.rpc('cancel_form_autofill', {
          p_form_id: id,
          p_target_status: previousStatus,
        });
      } catch (resetErr) {
        log.logError('Failed to reset form status after AI error', resetErr, { formId: id });
      }
      // Don't expose internal AI error details to client
      return NextResponse.json(
        {
          error: 'AI autofill failed',
          message: 'The AI service encountered an issue. Please try again later.',
        },
        { status: 500 }
      );
    }

    // Convert autofill fields to a record format for storage
    const aiFilledData: Record<string, unknown> = {};
    const confidenceScores: Record<string, number> = {};

    for (const field of autofillResult.fields) {
      if (field.suggested_value) {
        aiFilledData[field.field_id] = field.suggested_value;
        confidenceScores[field.field_id] = field.confidence || 0;
      }
    }

    // Store metadata about fields requiring review
    const fieldsRequiringReview = autofillResult.fields
      .filter((f) => f.requires_review)
      .map((f) => f.field_id);

    // Update form with AI results - ATOMIC operation with all data together
    // This prevents partial state if the update fails partway through
    const atomicUpdateData = {
      status: 'ai_filled' as const,
      ai_filled_data: {
        ...aiFilledData,
        _metadata: {
          generated_at: new Date().toISOString(),
          model: 'claude-3',
          fields_requiring_review: fieldsRequiringReview,
          missing_documents: autofillResult.missing_documents,
          warnings: autofillResult.warnings,
          overall_confidence: autofillResult.overall_confidence,
          processing_time_ms: autofillResult.processing_time_ms,
        },
      },
      ai_confidence_scores: confidenceScores,
    };

    const updatedForm = await formsService.updateForm(id, atomicUpdateData);

    // Verify the update succeeded with all data
    if (!updatedForm || !updatedForm.ai_filled_data || !updatedForm.ai_confidence_scores) {
      log.logError('AI autofill update incomplete', new Error('Partial data saved'), { formId: id });
      return NextResponse.json(
        {
          error: 'Autofill save failed',
          message: 'Failed to save AI autofill data completely. Please try again.',
        },
        { status: 500 }
      );
    }

    const autofillFieldNames = autofillResult.fields.map((f) => f.field_id);
    logAIRequest({
      operation: 'form_autofill',
      provider: 'anthropic',
      userId: user.id,
      caseId: form.case_id,
      formId: id,
      dataFieldsSent: [
        'form_type',
        'visa_type',
        'existing_form_data_keys',
        'document_extracted_field_names',
        ...autofillFieldNames,
      ],
      model: 'claude-3',
      processingTimeMs: autofillResult.processing_time_ms,
    });

    trackUsage(user.id, 'ai_requests').catch((err) => {
      log.warn('Usage tracking failed', { error: err instanceof Error ? err.message : String(err) });
    });

    return NextResponse.json({
      form: updatedForm,
      autofill: {
        form_type: autofillResult.form_type,
        overall_confidence: autofillResult.overall_confidence,
        processing_time_ms: autofillResult.processing_time_ms,
        fields_filled: Object.keys(aiFilledData).length,
        fields_requiring_review: fieldsRequiringReview.length,
        missing_documents: autofillResult.missing_documents,
        warnings: autofillResult.warnings,
      },
    });
  } catch (error) {
    log.logError('Error autofilling form', error, { formId: id });
    // Reset via cancel RPC (acquires advisory lock, checks auth, bypasses RLS).
    // Creates a new client because the original may be out of scope or corrupt.
    if (id !== 'unknown') {
      try {
        const supabaseCleanup = await createClient();
        await supabaseCleanup.rpc('cancel_form_autofill', {
          p_form_id: id,
          p_target_status: previousStatus,
        });
      } catch (resetErr) {
        log.logError('Failed to reset form status', resetErr, { formId: id });
      }
    }
    return NextResponse.json(
      { error: 'Failed to autofill form' },
      { status: 500 }
    );
  }
}
