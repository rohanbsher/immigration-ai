/**
 * Document Analysis Worker Processor
 *
 * Processes document analysis jobs: generates a signed URL from storage,
 * runs vision OCR (via the configured provider), and updates the document
 * record with results.
 *
 * The circuit breaker is selected based on the active provider so that
 * failures are attributed to the correct service.
 */

import { Job } from 'bullmq';
import type { DocumentAnalysisJob } from '@/lib/jobs/types';
import { analyzeDocument } from '@/lib/ai/document-analysis';
import type { DocumentAnalysisResult } from '@/lib/ai/types';
import { openaiBreaker, anthropicBreaker } from '@/lib/ai/circuit-breaker';
import { features } from '@/lib/config';
import { CLAUDE_MODEL } from '@/lib/ai/client';
import { validateStorageUrl } from '@/lib/security/url-validation';
import { logAIRequest } from '@/lib/audit/ai-audit';
import { getWorkerSupabase } from '../supabase';
import { trackUsage } from '../track-usage';

const MIN_CONFIDENCE_THRESHOLD = 0.5;
/** Signed URL lifetime in seconds (Supabase storage API expects seconds). */
const SIGNED_URL_EXPIRY_SECONDS = 600;

/**
 * Select the appropriate circuit breaker based on the configured provider.
 * In 'auto' mode the fallback logic lives inside `analyzeDocument`, so
 * we skip the worker-level breaker to avoid double-wrapping.
 */
function getCircuitBreaker() {
  const provider = features.documentAnalysisProvider;
  if (provider === 'claude') return anthropicBreaker;
  if (provider === 'openai') return openaiBreaker;
  // 'auto' -- the document-analysis module handles its own fallback/breaker
  return null;
}

function getAuditProvider(): 'openai' | 'anthropic' {
  const provider = features.documentAnalysisProvider;
  if (provider === 'claude') return 'anthropic';
  if (provider === 'openai') return 'openai';
  return 'anthropic'; // auto defaults to Claude-first
}

function getAuditModel(): string {
  const provider = features.documentAnalysisProvider;
  if (provider === 'openai') return 'gpt-4o';
  return CLAUDE_MODEL;
}

export async function processDocumentAnalysis(
  job: Job<DocumentAnalysisJob>
): Promise<{ documentId: string; status: string; confidence: number }> {
  const { documentId, caseId, documentType, storagePath } = job.data;
  const supabase = getWorkerSupabase();

  await job.updateProgress(10);

  // 1. Generate a signed URL for the document
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

  if (signedUrlError || !signedUrlData) {
    throw new Error(`Failed to generate signed URL for document ${documentId}: ${signedUrlError?.message}`);
  }

  const signedUrl = signedUrlData.signedUrl;
  if (!validateStorageUrl(signedUrl)) {
    throw new Error(`Invalid signed URL - possible SSRF attempt for document ${documentId}`);
  }

  await job.updateProgress(20);

  // 2. Run AI analysis (optionally wrapped in provider-specific circuit breaker)
  let analysisResult: DocumentAnalysisResult;
  const breaker = getCircuitBreaker();
  try {
    const runAnalysis = () =>
      analyzeDocument({
        documentId,
        fileUrl: signedUrl,
        documentType,
        options: {
          extract_raw_text: true,
          high_accuracy_mode: true,
        },
      });

    analysisResult = breaker
      ? await breaker.execute(runAnalysis)
      : await runAnalysis();
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

  logAIRequest({
    operation: 'document_analysis',
    provider: getAuditProvider(),
    userId: job.data.userId,
    caseId: job.data.caseId,
    documentId: job.data.documentId,
    dataFieldsSent: ['document_image', 'document_type'],
    model: getAuditModel(),
  });

  trackUsage(job.data.userId, 'ai_requests').catch(() => {});

  await job.updateProgress(100);

  return {
    documentId,
    status: newStatus,
    confidence: analysisResult.overall_confidence,
  };
}
