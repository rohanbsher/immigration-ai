/**
 * Document Analysis Worker Processor
 *
 * Processes document analysis jobs: generates a signed URL from storage,
 * runs GPT-4 Vision OCR, and updates the document record with results.
 */

import { Job } from 'bullmq';
import type { DocumentAnalysisJob } from '@/lib/jobs/types';
import { analyzeDocument } from '@/lib/ai/document-analysis';
import type { DocumentAnalysisResult } from '@/lib/ai/types';
import { openaiBreaker } from '@/lib/ai/circuit-breaker';
import { getWorkerSupabase } from '../supabase';

const MIN_CONFIDENCE_THRESHOLD = 0.5;
const SIGNED_URL_EXPIRY = 600; // 10 minutes

export async function processDocumentAnalysis(
  job: Job<DocumentAnalysisJob>
): Promise<{ documentId: string; status: string; confidence: number }> {
  const { documentId, caseId, documentType, storagePath } = job.data;
  const supabase = getWorkerSupabase();

  await job.updateProgress(10);

  // 1. Generate a signed URL for the document
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (signedUrlError || !signedUrlData) {
    throw new Error(`Failed to generate signed URL for document ${documentId}: ${signedUrlError?.message}`);
  }

  await job.updateProgress(20);

  // 2. Run AI analysis (wrapped in circuit breaker)
  let analysisResult: DocumentAnalysisResult;
  try {
    analysisResult = await openaiBreaker.execute(() =>
      analyzeDocument({
        documentId,
        fileUrl: signedUrlData.signedUrl,
        documentType,
        options: {
          extract_raw_text: true,
          high_accuracy_mode: true,
        },
      })
    );
  } catch (aiError) {
    // Reset document status on AI failure
    await supabase
      .from('documents')
      .update({ status: 'uploaded', updated_at: new Date().toISOString() })
      .eq('id', documentId);
    throw aiError;
  }

  await job.updateProgress(80);

  // 3. Convert extracted fields to storage format
  const extractedData: Record<string, unknown> = {};
  for (const field of analysisResult.extracted_fields) {
    if (!field.field_name) continue;
    extractedData[field.field_name] = {
      value: field.value,
      confidence: field.confidence,
      requires_verification: field.requires_verification,
      source_location: field.source_location,
    };
  }

  if (analysisResult.raw_text) {
    extractedData['_raw_text'] = analysisResult.raw_text;
  }

  if (analysisResult.warnings && analysisResult.warnings.length > 0) {
    extractedData['_warnings'] = analysisResult.warnings;
  }

  const isLowConfidence = analysisResult.overall_confidence < MIN_CONFIDENCE_THRESHOLD;
  if (isLowConfidence) {
    extractedData['_low_confidence_warning'] =
      `Analysis confidence (${Math.round(analysisResult.overall_confidence * 100)}%) is below the minimum threshold (${MIN_CONFIDENCE_THRESHOLD * 100}%). Manual verification required.`;
  }

  // 4. Determine new status
  let newStatus: string;
  if (analysisResult.errors && analysisResult.errors.length > 0) {
    newStatus = 'uploaded';
  } else if (isLowConfidence) {
    newStatus = 'needs_review';
  } else {
    newStatus = 'analyzed';
  }

  // 5. Update document with results
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      status: newStatus,
      ai_extracted_data: extractedData,
      ai_confidence_score: analysisResult.overall_confidence,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (updateError) {
    throw new Error(`Failed to update document ${documentId}: ${updateError.message}`);
  }

  await job.updateProgress(100);

  return {
    documentId,
    status: newStatus,
    confidence: analysisResult.overall_confidence,
  };
}
