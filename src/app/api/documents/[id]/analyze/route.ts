import { NextRequest } from 'next/server';
import { documentsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { analyzeDocument, type DocumentAnalysisResult } from '@/lib/ai';
import { createLogger } from '@/lib/logger';
import { enforceQuota, trackUsage } from '@/lib/billing/quota';
import { handleQuotaError } from '@/lib/billing/quota-error';
import { validateStorageUrl } from '@/lib/security';
import { isValidTransition, getValidNextStates } from '@/lib/db/document-state-machine';
import { SIGNED_URL_EXPIRATION } from '@/lib/storage';
import { logAIRequest } from '@/lib/audit/ai-audit';
import { withAuth, successResponse, errorResponse, requireAiConsent } from '@/lib/auth/api-helpers';
import { features } from '@/lib/config';
import { enqueueDocumentAnalysis } from '@/lib/jobs/queues';

const log = createLogger('api:documents-analyze');

// Minimum confidence threshold for accepting AI analysis results
// Documents below this threshold are flagged for manual review
const MIN_CONFIDENCE_THRESHOLD = 0.5;

export const POST = withAuth(async (request: NextRequest, context, auth) => {
  const { id } = await context.params!;

  // Track state for proper cleanup in error handlers
  let statusWasSet = false;

  // AI consent check
  const consentError = await requireAiConsent(auth.user.id);
  if (consentError) return consentError;

  // Quota enforcement
  try {
    await enforceQuota(auth.user.id, 'ai_requests');
  } catch (error) {
    const qr = handleQuotaError(error, 'ai_requests');
    if (qr) return qr;
    throw error;
  }

  // Get the document
  const document = await documentsService.getDocument(id);

  if (!document) {
    return errorResponse('Document not found', 404);
  }

  // Authorization check - get the case and verify user is the attorney
  const caseData = await casesService.getCase(document.case_id);

  if (!caseData) {
    return errorResponse('Case not found', 404);
  }

  // Only the attorney can trigger document analysis
  if (caseData.attorney_id !== auth.user.id) {
    return errorResponse('Forbidden', 403);
  }

  // Block analysis for documents with degraded scan status
  if (document.scan_status === 'degraded') {
    log.warn('Analysis blocked for scan-degraded document', { documentId: id, userId: auth.user.id });
    return errorResponse('This document is pending security scan and cannot be analyzed yet.', 403);
  }

  // Check if document has expired (either by status or by expiration_date)
  if (document.status === 'expired') {
    return errorResponse('Document has expired and cannot be analyzed', 410);
  }

  if (document.expiration_date && new Date(document.expiration_date) < new Date()) {
    return errorResponse('Document has expired and cannot be analyzed', 410);
  }

  // Validate that analysis is allowed from current state using state machine
  if (!isValidTransition(document.status, 'processing')) {
    const validStates = getValidNextStates(document.status);
    return errorResponse(
      `Cannot analyze a document with status '${document.status}'. ` +
      (validStates.length > 0
        ? `Valid operations would transition to: ${validStates.join(', ')}`
        : 'This is a terminal state.'),
      400,
      { message: 'Invalid operation' }
    );
  }

  // Check if document has a file URL
  if (!document.file_url) {
    return errorResponse('Document has no file to analyze', 400);
  }

  const supabase = await createClient();

  // CAS (Compare-and-Swap) protection against concurrent analysis:
  // Only transition to 'processing' if status hasn't changed since we read it.
  // This prevents two concurrent requests from both starting analysis.
  const previousStatus = document.status;
  const { data: casResult, error: casError } = await supabase
    .from('documents')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', previousStatus) // CAS condition: only update if status is still what we read
    .select('id')
    .single();

  if (casError || !casResult) {
    return errorResponse('Document analysis is already in progress. Please try again later.', 409);
  }
  statusWasSet = true;

  // Wrap post-CAS logic so we can reset document status on unexpected errors
  try {

  // Async path: enqueue job when worker is enabled
  if (features.workerEnabled) {
    try {
      const job = await enqueueDocumentAnalysis({
        documentId: id,
        userId: auth.user.id,
        caseId: document.case_id,
        documentType: document.document_type,
        storagePath: document.file_url,
        requestId: request.headers.get('x-request-id') ?? undefined,
      });

      trackUsage(auth.user.id, 'ai_requests').catch((err) => {
        log.warn('Usage tracking failed', { error: err instanceof Error ? err.message : String(err) });
      });

      return successResponse(
        { jobId: job.id, status: 'queued', message: 'Document analysis has been queued for processing.' },
        202
      );
    } catch (enqueueErr) {
      log.warn('Failed to enqueue document analysis job, falling back to sync', {
        error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
      });
      // Fall through to synchronous path below
    }
  }

  let analysisResult: DocumentAnalysisResult;

  try {
    // Generate a temporary signed URL from the stored storage path
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.file_url, SIGNED_URL_EXPIRATION.AI_PROCESSING);

    if (signedUrlError || !signedUrlData) {
      await documentsService.updateDocument(id, { status: 'uploaded' });
      log.logError('Failed to generate signed URL for analysis', signedUrlError, {
        documentId: id,
      });
      return errorResponse('Failed to access document file', 500);
    }

    const fileUrl = signedUrlData.signedUrl;

    // SSRF protection: validate signed URL is from our Supabase storage
    if (!validateStorageUrl(fileUrl)) {
      await documentsService.updateDocument(id, { status: 'uploaded' });
      log.logError('Invalid signed URL - possible SSRF attempt', null, {
        documentId: id,
        storagePath: document.file_url,
      });
      return errorResponse('Invalid document URL', 400);
    }

    // Analyze the document using AI
    analysisResult = await analyzeDocument({
      documentId: id,
      fileUrl: fileUrl,
      documentType: document.document_type,
      options: {
        extract_raw_text: true,
        high_accuracy_mode: true,
      },
    });
  } catch (aiError) {
    // If AI analysis fails, update status and return error
    await documentsService.updateDocument(id, { status: 'uploaded' });

    log.logError('AI analysis error', aiError);
    // Don't expose internal AI error details to client
    return errorResponse('The AI service encountered an issue. Please try again later.', 500, {
      message: 'AI analysis failed',
    });
  }

  // Convert extracted fields to a record format for storage
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

  // Include raw text if available
  if (analysisResult.raw_text) {
    extractedData['_raw_text'] = analysisResult.raw_text;
  }

  // Include any warnings
  if (analysisResult.warnings && analysisResult.warnings.length > 0) {
    extractedData['_warnings'] = analysisResult.warnings;
  }

  // Check if confidence is below minimum threshold
  const isLowConfidence = analysisResult.overall_confidence < MIN_CONFIDENCE_THRESHOLD;
  if (isLowConfidence) {
    extractedData['_low_confidence_warning'] =
      `Analysis confidence (${Math.round(analysisResult.overall_confidence * 100)}%) is below the minimum threshold (${MIN_CONFIDENCE_THRESHOLD * 100}%). Manual verification required.`;
  }

  // Determine document status based on analysis results
  let newStatus: 'uploaded' | 'analyzed' | 'needs_review';
  if (analysisResult.errors && analysisResult.errors.length > 0) {
    newStatus = 'uploaded'; // Revert status if there were errors
  } else if (isLowConfidence) {
    newStatus = 'needs_review'; // Flag for manual review if low confidence
  } else {
    newStatus = 'analyzed';
  }

  // Update document with AI results
  const updatedDocument = await documentsService.updateDocument(id, {
    status: newStatus,
    ai_extracted_data: extractedData,
    ai_confidence_score: analysisResult.overall_confidence,
  });

  logAIRequest({
    operation: 'document_analysis',
    provider: 'openai',
    userId: auth.user.id,
    caseId: document.case_id,
    documentId: id,
    dataFieldsSent: ['document_image', 'document_type'],
    model: 'gpt-4-vision',
    processingTimeMs: analysisResult.processing_time_ms,
  });

  trackUsage(auth.user.id, 'ai_requests').catch((err) => {
    log.warn('Usage tracking failed', { error: err instanceof Error ? err.message : String(err) });
  });

  return successResponse({
    document: updatedDocument,
    analysis: {
      document_type: analysisResult.document_type,
      overall_confidence: analysisResult.overall_confidence,
      processing_time_ms: analysisResult.processing_time_ms,
      fields_extracted: analysisResult.extracted_fields.length,
      warnings: analysisResult.warnings,
      errors: analysisResult.errors,
      requires_manual_review: isLowConfidence,
      confidence_threshold: MIN_CONFIDENCE_THRESHOLD,
    },
  });

  } catch (error) {
    // Reset document status if we set it to 'processing' but something failed
    if (statusWasSet) {
      try {
        await documentsService.updateDocument(id, { status: 'uploaded' });
      } catch (resetErr) {
        log.logError('Failed to reset document status', resetErr, { documentId: id });
      }
    }
    throw error; // Re-throw so withAuth's catch logs it and returns 500
  }
}, { rateLimit: 'SENSITIVE' });
