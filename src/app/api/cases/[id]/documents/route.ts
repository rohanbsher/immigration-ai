import { NextRequest, NextResponse } from 'next/server';
import { documentsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { sensitiveRateLimiter } from '@/lib/rate-limit';
import { validateFile } from '@/lib/file-validation';
import { sendDocumentUploadedEmail } from '@/lib/email/notifications';
import { enforceQuota, QuotaExceededError } from '@/lib/billing/quota';

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Verify user has access to this case (is attorney or client)
 */
async function verifyCaseAccess(userId: string, caseId: string): Promise<boolean> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return false;
  return caseData.attorney_id === userId || caseData.client_id === userId;
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
    const hasAccess = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documents = await documentsService.getDocumentsByCase(caseId);

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
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

    // Verify user has access to this case
    const hasAccess = await verifyCaseAccess(user.id, caseId);
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
          { error: 'You have reached your storage limit. Please upgrade your plan.' },
          { status: 403 }
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

    if (!documentType) {
      return NextResponse.json(
        { error: 'Document type is required' },
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
      console.error('File validation failed:', {
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
      console.warn('File validation warnings:', {
        fileName: file.name,
        warnings: validationResult.typeValidation.warnings,
      });
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${caseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    // Create document record
    const document = await documentsService.createDocument({
      case_id: caseId,
      document_type: documentType as Parameters<typeof documentsService.createDocument>[0]['document_type'],
      file_name: file.name,
      file_url: publicUrl,
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
      console.error('Failed to send document upload email:', err);
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
