import { caseMessagesService, casesService } from '@/lib/db';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { sendCaseUpdateEmail } from '@/lib/email/notifications';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:case-messages');

const createMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(10000, 'Message too long'),
});

/**
 * Verify user has access to this case (is attorney or client only).
 * Attorney-client privilege: no other role may access case messages.
 */
async function verifyCaseAccess(userId: string, caseId: string): Promise<boolean> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return false;
  return caseData.attorney_id === userId || caseData.client_id === userId;
}

/**
 * GET /api/cases/[id]/messages - Get all messages for a case
 */
export const GET = withAuth(async (request, context, auth) => {
  const { id: caseId } = await context.params!;

  // Verify user has access to this case
  const hasAccess = await verifyCaseAccess(auth.user.id, caseId);
  if (!hasAccess) {
    return errorResponse('Forbidden', 403);
  }

  // Get pagination params
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  const { data: messages, total } = await caseMessagesService.getMessages(caseId, {
    limit,
    offset,
  });

  // Mark messages as read for the current user
  await caseMessagesService.markAllAsRead(caseId, auth.user.id);

  return successResponse({
    data: messages,
    total,
    limit,
    offset,
  });
}, { rateLimit: 'STANDARD' });

/**
 * POST /api/cases/[id]/messages - Send a new message
 */
export const POST = withAuth(async (request, context, auth) => {
  const { id: caseId } = await context.params!;

  // Verify user has access to this case
  const hasAccess = await verifyCaseAccess(auth.user.id, caseId);
  if (!hasAccess) {
    return errorResponse('Forbidden', 403);
  }

  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const parseResult = createMessageSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse(parseResult.error.issues[0].message, 400);
  }
  const validatedData = parseResult.data;

  const message = await caseMessagesService.createMessage({
    case_id: caseId,
    sender_id: auth.user.id,
    content: validatedData.content,
  });

  log.info('Message sent', { caseId, senderId: auth.user.id, messageId: message.id });

  // Notify the other party (fire-and-forget)
  sendCaseUpdateEmail(caseId, 'note_added', 'New message received', auth.user.id)
    .catch((err) => log.logError('Failed to send message notification', err));

  return successResponse(message, 201);
}, { rateLimit: 'STANDARD' });
