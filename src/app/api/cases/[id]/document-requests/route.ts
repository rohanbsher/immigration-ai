import { documentRequestsService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { DOCUMENT_TYPES } from '@/lib/validation';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:document-requests');

const createRequestSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES, { message: 'Invalid document type' }),
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
export const GET = withAuth(async (request, context, auth) => {
  const { id: caseId } = await context.params!;

  const { hasAccess } = await verifyCaseAccess(auth.user.id, caseId);
  if (!hasAccess) {
    return errorResponse('Forbidden', 403);
  }

  const { searchParams } = new URL(request.url);
  const pendingOnly = searchParams.get('pending') === 'true';

  const requests = pendingOnly
    ? await documentRequestsService.getPendingRequestsByCase(caseId)
    : await documentRequestsService.getRequestsByCase(caseId);

  return successResponse({ data: requests });
}, { rateLimit: 'STANDARD' });

/**
 * POST /api/cases/[id]/document-requests - Create a new document request
 */
export const POST = withAuth(async (request, context, auth) => {
  const { id: caseId } = await context.params!;

  const { hasAccess, isAttorney } = await verifyCaseAccess(auth.user.id, caseId);
  if (!hasAccess) {
    return errorResponse('Forbidden', 403);
  }

  // Only attorneys can create requests
  if (!isAttorney) {
    return errorResponse('Only attorneys can create document requests', 403);
  }

  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const parseResult = createRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse(parseResult.error.issues[0].message, 400);
  }
  const validatedData = parseResult.data;

  const documentRequest = await documentRequestsService.createRequest({
    case_id: caseId,
    requested_by: auth.user.id,
    ...validatedData,
  });

  log.info('Document request created', { caseId, requestId: documentRequest.id });

  return successResponse(documentRequest, 201);
}, { rateLimit: 'STANDARD' });
