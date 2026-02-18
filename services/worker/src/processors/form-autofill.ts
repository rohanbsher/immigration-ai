/**
 * Form Autofill Worker Processor
 *
 * Processes form autofill jobs: gathers analyzed documents for the case,
 * runs Claude for AI field mapping, and updates the form with results.
 */

import { Job } from 'bullmq';
import type { FormAutofillJob } from '@/lib/jobs/types';
import {
  autofillForm,
  type FormAutofillResult,
  type DocumentAnalysisResult,
  type ExtractedField,
} from '@/lib/ai';
import { anthropicBreaker } from '@/lib/ai/circuit-breaker';
import { getWorkerSupabase } from '../supabase';

export async function processFormAutofill(
  job: Job<FormAutofillJob>
): Promise<{ formId: string; fieldsFilled: number; confidence: number }> {
  const { formId, userId, caseId, formType } = job.data;
  const supabase = getWorkerSupabase();

  await job.updateProgress(10);

  // 1. Get the form and case context
  const [formResult, caseResult] = await Promise.all([
    supabase.from('forms').select('*').eq('id', formId).single(),
    supabase.from('cases').select('visa_type').eq('id', caseId).single(),
  ]);

  if (formResult.error || !formResult.data) {
    throw new Error(`Form not found: ${formId}`);
  }
  if (caseResult.error || !caseResult.data) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const form = formResult.data;
  const visaType = caseResult.data.visa_type;

  await job.updateProgress(20);

  // 2. Get analyzed documents for the case
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, document_type, status, ai_extracted_data, ai_confidence_score')
    .eq('case_id', caseId)
    .eq('status', 'analyzed')
    .not('ai_extracted_data', 'is', null)
    .is('deleted_at', null);

  if (docsError) {
    throw new Error(`Failed to fetch documents: ${docsError.message}`);
  }

  if (!documents || documents.length === 0) {
    // Reset form status
    await supabase
      .from('forms')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', formId);
    throw new Error('No analyzed documents available for autofill');
  }

  await job.updateProgress(30);

  // 3. Convert documents to AI-expected format
  const documentAnalyses: DocumentAnalysisResult[] = documents.map((doc) => {
    const extractedData =
      doc.ai_extracted_data != null &&
      typeof doc.ai_extracted_data === 'object' &&
      !Array.isArray(doc.ai_extracted_data)
        ? (doc.ai_extracted_data as Record<string, unknown>)
        : {};

    const extractedFields: ExtractedField[] = [];

    for (const [key, value] of Object.entries(extractedData)) {
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
  });

  await job.updateProgress(40);

  // 4. Run AI autofill (wrapped in circuit breaker)
  let autofillResult: FormAutofillResult;
  try {
    autofillResult = await anthropicBreaker.execute(() =>
      autofillForm({
        formType,
        caseId,
        documentAnalyses,
        existingFormData:
          form.form_data != null &&
          typeof form.form_data === 'object' &&
          !Array.isArray(form.form_data)
            ? (form.form_data as Record<string, string>)
            : {},
        visaType,
      })
    );
  } catch (aiError) {
    // Reset form status on AI failure
    await supabase
      .from('forms')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', formId);
    throw aiError;
  }

  await job.updateProgress(80);

  // 5. Convert results for storage
  const aiFilledData: Record<string, unknown> = {};
  const confidenceScores: Record<string, number> = {};

  for (const field of autofillResult.fields) {
    if (field.suggested_value) {
      aiFilledData[field.field_id] = field.suggested_value;
      confidenceScores[field.field_id] = field.confidence || 0;
    }
  }

  const fieldsRequiringReview = autofillResult.fields
    .filter((f) => f.requires_review)
    .map((f) => f.field_id);

  // 6. Update form with AI results
  const { error: updateError } = await supabase
    .from('forms')
    .update({
      status: 'ai_filled',
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', formId);

  if (updateError) {
    throw new Error(`Failed to update form ${formId}: ${updateError.message}`);
  }

  await job.updateProgress(100);

  return {
    formId,
    fieldsFilled: Object.keys(aiFilledData).length,
    confidence: autofillResult.overall_confidence,
  };
}
