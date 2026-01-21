import { NextRequest, NextResponse } from 'next/server';
import { documentsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { sensitiveRateLimiter } from '@/lib/rate-limit';
import { auditService } from '@/lib/audit';

const updateDocumentSchema = z.object({
  document_type: z.string().optional(),
  status: z.string().optional(),
  expiration_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Verify that the current user can access this document via its case.
 * Returns the document if accessible, along with permission flags.
 */
async function getDocumentWithAccess(userId: string, documentId: string): Promise<{
  document: Awaited<ReturnType<typeof documentsService.getDocument>>;
  canModify: boolean;
  canDelete: boolean;
} | null> {
  const document = await documentsService.getDocument(documentId);

  if (!document) {
    return null;
  }

  // Get the case to check access
  const caseData = await casesService.getCase(document.case_id);

  if (!caseData) {
    return null;
  }

  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;
  const isUploader = document.uploaded_by === userId;

  if (!isAttorney && !isClient) {
    return null;
  }

  return {
    document,
    canModify: isAttorney, // Only attorneys can modify documents
    canDelete: isAttorney || isUploader, // Attorneys or uploader can delete
  };
}

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

    // Rate limiting: 20 requests per minute (prevent document scraping)
    const rateLimitResult = await sensitiveRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const accessResult = await getDocumentWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Log document access for compliance audit trail
    await auditService.logAccess('documents', id, {
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      additional_context: {
        document_type: accessResult.document?.document_type,
        case_id: accessResult.document?.case_id,
      },
    });

    return NextResponse.json(accessResult.document);
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const accessResult = await getDocumentWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!accessResult.canModify) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateDocumentSchema.parse(body);

    const updatedDocument = await documentsService.updateDocument(id, validatedData as Parameters<typeof documentsService.updateDocument>[1]);

    return NextResponse.json(updatedDocument);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const accessResult = await getDocumentWithAccess(user.id, id);

    if (!accessResult) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!accessResult.canDelete) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Extract file path from URL and delete from storage
    try {
      const fileUrl = new URL(accessResult.document!.file_url);
      const filePath = fileUrl.pathname.split('/').slice(-2).join('/');
      await supabase.storage.from('documents').remove([filePath]);
    } catch (storageError) {
      console.error('Error deleting file from storage:', storageError);
      // Continue with document deletion even if storage deletion fails
    }

    await documentsService.deleteDocument(id);

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
