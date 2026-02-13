import { NextRequest, NextResponse } from 'next/server';
import { documentsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { sensitiveRateLimiter } from '@/lib/rate-limit';
import { validateFile } from '@/lib/file-validation';
import { sendDocumentUploadedEmail } from '@/lib/email/notifications';
import { enforceQuota, enforceQuotaForCase, QuotaExceededError } from '@/lib/billing/quota';
import { createLogger } from '@/lib/logger';
import { SIGNED_URL_EXPIRATION } from '@/lib/storage';
import { DOCUMENT_TYPES } from '@/lib/validation';
import type { CaseAccessResult } from '@/types';

const log = createLogger('api:case-documents');

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Verify user has access to this case (is attorney or client)
 * Returns the attorney_id to avoid double lookup in quota checks
 */
async function verifyCaseAccess(userId: string, caseId: string): Promise<CaseAccessResult> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return { hasAccess: false };
  const hasAccess = caseData.attorney_id === userId || caseData.client_id === userId;
  return { hasAccess, attorneyId: caseData.attorney_id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this case
    const { hasAccess } = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this case (and get attorneyId to avoid double lookup)
    const { hasAccess, attorneyId } = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rate limiting: 20 uploads per minute (prevent storage abuse)
    const rateLimitResult = await sensitiveRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Enforce storage quota
    try {
      await enforceQuota(user.id, 'storage');
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return NextResponse.json(
          { error: 'You have reached your storage limit. Please upgrade your plan.', code: 'QUOTA_EXCEEDED' },
          { status: 402 }
        );
      }
      throw error;
    }

    // Enforce per-case document quota (pass attorneyId to avoid double case lookup)
    try {
      await enforceQuotaForCase(caseId, 'documents', attorneyId);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return NextResponse.json(
          { error: 'You have reached the document limit for this case. Please upgrade your plan.', code: 'QUOTA_EXCEEDED' },
          { status: 402 }
        );
      }
      throw error;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('document_type') as string;
    const expirationDate = formData.get('expiration_date') as string | null;
    const notes = formData.get('notes') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!documentType || !(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      return NextResponse.json(
        { error: !documentType ? 'Document type is required' : 'Invalid document type' },
        { status: 400 }
      );
    }

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
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

    // Log any warnings from validation
    if (validationResult.typeValidation.warnings.length > 0) {
      log.warn('File validation warnings', {
        fileName: file.name,
        warnings: validationResult.typeValidation.warnings,
      });
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${caseId}/${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (uploadError) {
      log.logError('Upload error', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Store the storage path (not a public URL) to prevent public access.
    // Signed URLs are generated at read time in GET endpoints.
    const storagePath = fileName;

    // Create document record
    const document = await documentsService.createDocument({
      case_id: caseId,
      document_type: documentType as Parameters<typeof documentsService.createDocument>[0]['document_type'],
      file_name: file.name,
      file_url: storagePath,
      file_size: file.size,
      mime_type: file.type,
      expiration_date: expirationDate || undefined,
      notes: notes || undefined,
    });

    // Send email notification (fire and forget)
    sendDocumentUploadedEmail(
      caseId,
      file.name,
      documentType,
      user.id
    ).catch((err) => {
      log.logError('Failed to send document upload email', err);
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    log.logError('Error uploading document', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
