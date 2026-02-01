import { NextRequest, NextResponse } from 'next/server';
import { documentRequestsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { standardRateLimiter, sensitiveRateLimiter } from '@/lib/rate-limit';

const log = createLogger('api:document-request');

const updateRequestSchema = z.object({
  status: z.enum(['pending', 'uploaded', 'fulfilled', 'expired', 'cancelled']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  fulfilled_by_document_id: z.string().uuid().nullable().optional(),
});

/**
 * Verify user has access to this document request
 */
async function verifyRequestAccess(
  userId: string,
  requestId: string
): Promise<{ hasAccess: boolean; isAttorney: boolean; request: Awaited<ReturnType<typeof documentRequestsService.getRequest>> }> {
  const request = await documentRequestsService.getRequest(requestId);
  if (!request) return { hasAccess: false, isAttorney: false, request: null };

  const caseData = await casesService.getCase(request.case_id);
  if (!caseData) return { hasAccess: false, isAttorney: false, request: null };

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
    request,
  };
}

/**
 * GET /api/document-requests/[id] - Get a single document request
 */
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

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { hasAccess, request: docRequest } = await verifyRequestAccess(user.id, id);
    if (!hasAccess || !docRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(docRequest);
  } catch (error) {
    log.logError('Failed to fetch document request', error);
    return NextResponse.json(
      { error: 'Failed to fetch document request' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/document-requests/[id] - Update a document request
 */
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

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { hasAccess, isAttorney, request: docRequest } = await verifyRequestAccess(user.id, id);
    if (!hasAccess || !docRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateRequestSchema.parse(body);

    // Clients can only update status to 'uploaded' and set fulfilled_by_document_id
    if (!isAttorney) {
      const allowedFields = ['status', 'fulfilled_by_document_id'];
      const requestedFields = Object.keys(validatedData);
      const hasDisallowedFields = requestedFields.some((f) => !allowedFields.includes(f));

      if (hasDisallowedFields) {
        return NextResponse.json(
          { error: 'Clients can only update status and fulfilled document' },
          { status: 403 }
        );
      }

      if (validatedData.status && validatedData.status !== 'uploaded') {
        return NextResponse.json(
          { error: 'Clients can only set status to uploaded' },
          { status: 403 }
        );
      }
    }

    const updatedRequest = await documentRequestsService.updateRequest(id, validatedData);

    log.info('Document request updated', { requestId: id, updates: Object.keys(validatedData) });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    log.logError('Failed to update document request', error);
    return NextResponse.json(
      { error: 'Failed to update document request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/document-requests/[id] - Delete a document request
 */
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

    // Rate limit check (using sensitive for destructive actions)
    const rateLimitResult = await sensitiveRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { hasAccess, isAttorney, request: docRequest } = await verifyRequestAccess(user.id, id);
    if (!hasAccess || !docRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Only attorneys can delete requests
    if (!isAttorney) {
      return NextResponse.json(
        { error: 'Only attorneys can delete document requests' },
        { status: 403 }
      );
    }

    await documentRequestsService.deleteRequest(id);

    log.info('Document request deleted', { requestId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.logError('Failed to delete document request', error);
    return NextResponse.json(
      { error: 'Failed to delete document request' },
      { status: 500 }
    );
  }
}
