import { NextResponse } from 'next/server';
import { documentsService, casesService, activitiesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { withAuth, errorResponse, successResponse } from '@/lib/auth/api-helpers';
import { validateFile } from '@/lib/file-validation';
import { sendDocumentUploadedEmail } from '@/lib/email/notifications';
import { enforceQuota, enforceQuotaForCase } from '@/lib/billing/quota';
import { handleQuotaError } from '@/lib/billing/quota-error';
import { createLogger } from '@/lib/logger';
import { SIGNED_URL_EXPIRATION } from '@/lib/storage';
import { DOCUMENT_TYPES } from '@/lib/validation';

const log = createLogger('api:case-documents');

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Verify user has access to this case (is attorney or client)
 * Returns the attorney_id to avoid double lookup in quota checks
 */
async function verifyCaseAccess(userId: string, caseId: string): Promise<{ hasAccess: boolean; attorneyId?: string }> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return { hasAccess: false };
  const hasAccess = caseData.attorney_id === userId || caseData.client_id === userId;
  return { hasAccess, attorneyId: caseData.attorney_id };
}

export const GET = withAuth(async (_request, context, auth) => {
  try {
    const { id: caseId } = await context.params!;

    // Verify user has access to this case
    const { hasAccess } = await verifyCaseAccess(auth.user.id, caseId);
    if (!hasAccess) {
      return errorResponse('Forbidden', 403);
    }

    const supabase = await createClient();
    const documents = await documentsService.getDocumentsByCase(caseId);

    // Generate signed URLs for each document so the frontend can access them
    const documentsWithSignedUrls = await Promise.all(
      documents.map(async (doc) => {
        if (!doc.file_url) return doc;
        try {
          const { data, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.file_url, SIGNED_URL_EXPIRATION.PREVIEW);
          if (error || !data) return doc;
          return { ...doc, file_url: data.signedUrl };
        } catch {
          return doc;
        }
      })
    );

    return NextResponse.json(documentsWithSignedUrls);
  } catch (error) {
    log.logError('Error fetching documents', error);
    return errorResponse('Failed to fetch documents', 500);
  }
});

export const POST = withAuth(async (request, context, auth) => {
  try {
    const { id: caseId } = await context.params!;

    // Verify user has access to this case (and get attorneyId to avoid double lookup)
    const { hasAccess, attorneyId } = await verifyCaseAccess(auth.user.id, caseId);
    if (!hasAccess) {
      return errorResponse('Forbidden', 403);
    }

    // Enforce storage quota
    try {
      await enforceQuota(auth.user.id, 'storage');
    } catch (error) {
      const qr = handleQuotaError(error, 'storage');
      if (qr) return qr;
      throw error;
    }

    // Enforce per-case document quota (pass attorneyId to avoid double case lookup)
    try {
      await enforceQuotaForCase(caseId, 'documents', attorneyId);
    } catch (error) {
      const qr = handleQuotaError(error, 'documents');
      if (qr) return qr;
      throw error;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('document_type') as string;
    const expirationDate = formData.get('expiration_date') as string | null;
    const notes = formData.get('notes') as string | null;

    if (!file) {
      return errorResponse('File is required', 400);
    }

    if (!documentType || !(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      return errorResponse(!documentType ? 'Document type is required' : 'Invalid document type', 400);
    }

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`, 400);
    }

    // Comprehensive file validation: magic bytes + virus scan
    const validationResult = await validateFile(file);

    if (!validationResult.isValid) {
      log.error('File validation failed', {
        fileName: file.name,
        claimedType: file.type,
        error: validationResult.error,
        typeValidation: validationResult.typeValidation,
        virusScan: validationResult.virusScan,
      });

      // Return appropriate status code based on validation failure type
      const statusCode = validationResult.virusScan && !validationResult.virusScan.isClean
        ? 422 // Unprocessable Entity for malware
        : 400; // Bad Request for invalid file type

      return NextResponse.json(
        {
          error: validationResult.error || 'File validation failed',
          details: {
            typeValid: validationResult.typeValidation.isValid,
            scanClean: validationResult.virusScan?.isClean ?? null,
            warnings: validationResult.typeValidation.warnings,
          },
        },
        { status: statusCode }
      );
    }

    // Log degraded scan status
    if (validationResult.scanDegraded) {
      log.warn('File uploaded with degraded virus scan', {
        fileName: file.name,
        userId: auth.user.id,
        caseId,
      });
    }

    // Log any warnings from validation
    if (validationResult.typeValidation.warnings.length > 0) {
      log.warn('File validation warnings', {
        fileName: file.name,
        warnings: validationResult.typeValidation.warnings,
      });
    }

    // Upload file to Supabase Storage
    const supabase = await createClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `${caseId}/${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (uploadError) {
      log.logError('Upload error', uploadError);
      return errorResponse('Failed to upload file', 500);
    }

    // Store the storage path (not a public URL) to prevent public access.
    // Signed URLs are generated at read time in GET endpoints.
    const storagePath = fileName;

    // Create document record -- clean up the storage file if DB insert fails
    let document;
    try {
      document = await documentsService.createDocument({
        case_id: caseId,
        document_type: documentType as Parameters<typeof documentsService.createDocument>[0]['document_type'],
        file_name: file.name,
        file_url: storagePath,
        file_size: file.size,
        mime_type: file.type,
        scan_status: validationResult.scanDegraded ? 'degraded' : 'clean',
        expiration_date: expirationDate || undefined,
        notes: notes || undefined,
      }, auth.user.id);
    } catch (dbError) {
      log.warn('DB insert failed after storage upload, cleaning up', { fileName });
      await supabase.storage.from('documents').remove([fileName]).catch((cleanupErr) => {
        log.logError('Failed to clean up orphaned storage file', cleanupErr);
      });
      throw dbError;
    }

    // Send email notification (fire and forget)
    sendDocumentUploadedEmail(
      caseId,
      file.name,
      documentType,
      auth.user.id
    ).catch((err) => {
      log.logError('Failed to send document upload email', err);
    });

    // Log activity (fire and forget)
    activitiesService.logDocumentUploaded(caseId, file.name, document.id, auth.user.id).catch(err => {
      log.warn('Activity log failed', { error: err });
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    log.logError('Error uploading document', error);
    return errorResponse('Failed to upload document', 500);
  }
});
