import { NextRequest, NextResponse } from 'next/server';
import { documentsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { analyzeDocument, type DocumentAnalysisResult } from '@/lib/ai';
import { aiRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:documents-analyze');

/**
 * Validates that a URL is from our trusted Supabase storage.
 * Prevents SSRF attacks by ensuring only internal storage URLs are processed.
 */
function validateStorageUrl(url: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;

  // Expected format: https://<project>.supabase.co/storage/v1/object/...
  const expectedPrefix = `${supabaseUrl}/storage/v1/object/`;
  return url.startsWith(expectedPrefix);
}

// Minimum confidence threshold for accepting AI analysis results
// Documents below this threshold are flagged for manual review
const MIN_CONFIDENCE_THRESHOLD = 0.5;

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

    // Rate limiting check for AI endpoints (10 requests per hour)
    const rateLimitResult = await aiRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Get the document
    const document = await documentsService.getDocument(id);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Authorization check - get the case and verify user is the attorney
    const caseData = await casesService.getCase(document.case_id);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Only the attorney can trigger document analysis
    if (caseData.attorney_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if document has a file URL
    if (!document.file_url) {
      return NextResponse.json(
        { error: 'Document has no file to analyze' },
        { status: 400 }
      );
    }

    // Update status to processing
    await documentsService.updateDocument(id, { status: 'processing' });

    let analysisResult: DocumentAnalysisResult;

    try {
      // Use the file URL directly (it's already a signed URL from Supabase storage)
      const fileUrl = document.file_url;

      // SSRF protection: validate URL is from our Supabase storage
      if (!validateStorageUrl(fileUrl)) {
        log.logError('Invalid document URL - possible SSRF attempt', null, {
          documentId: id,
          url: document.file_url
        });
        return NextResponse.json(
          { error: 'Invalid document URL' },
          { status: 400 }
        );
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
      return NextResponse.json(
        {
          error: 'AI analysis failed',
          message: 'The AI service encountered an issue. Please try again later.',
        },
        { status: 500 }
      );
    }

    // Convert extracted fields to a record format for storage
    const extractedData: Record<string, unknown> = {};
    for (const field of analysisResult.extracted_fields) {
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

    return NextResponse.json({
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
    log.logError('Error analyzing document', error);
    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 }
    );
  }
}
