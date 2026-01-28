import { NextRequest, NextResponse } from 'next/server';
import { documentRequestsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import type { DocumentType } from '@/types';

const log = createLogger('api:document-requests');

const createRequestSchema = z.object({
  document_type: z.string() as z.ZodType<DocumentType>,
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

/**
 * Verify user has access to this case
 */
async function verifyCaseAccess(
  userId: string,
  caseId: string
): Promise<{ hasAccess: boolean; isAttorney: boolean }> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return { hasAccess: false, isAttorney: false };

  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;

  // Check if admin
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const isAdmin = profile?.role === 'admin';

  return {
    hasAccess: isAttorney || isClient || isAdmin,
    isAttorney: isAttorney || isAdmin,
  };
}

/**
 * GET /api/cases/[id]/document-requests - Get all document requests for a case
 */
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

    const { hasAccess } = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const pendingOnly = searchParams.get('pending') === 'true';

    const requests = pendingOnly
      ? await documentRequestsService.getPendingRequestsByCase(caseId)
      : await documentRequestsService.getRequestsByCase(caseId);

    return NextResponse.json({ data: requests });
  } catch (error) {
    log.logError('Failed to fetch document requests', error);
    return NextResponse.json(
      { error: 'Failed to fetch document requests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cases/[id]/document-requests - Create a new document request
 */
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

    const { hasAccess, isAttorney } = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only attorneys can create requests
    if (!isAttorney) {
      return NextResponse.json(
        { error: 'Only attorneys can create document requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createRequestSchema.parse(body);

    const documentRequest = await documentRequestsService.createRequest({
      case_id: caseId,
      requested_by: user.id,
      ...validatedData,
    });

    log.info('Document request created', { caseId, requestId: documentRequest.id });

    return NextResponse.json(documentRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    log.logError('Failed to create document request', error);
    return NextResponse.json(
      { error: 'Failed to create document request' },
      { status: 500 }
    );
  }
}
