import { z } from 'zod';
import {
  getConversation,
  getConversationMessages,
  deleteConversation,
  updateConversationTitle,
} from '@/lib/db/conversations';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';

const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).trim(),
});

/**
 * GET /api/chat/[conversationId]
 *
 * Get a conversation and its messages.
 */
export const GET = withAuth(async (_request, context, auth) => {
  const { conversationId } = await context.params!;

  // Get conversation
  const conversation = await getConversation(conversationId, auth.user.id);
  if (!conversation) {
    return errorResponse('Conversation not found', 404);
  }

  // Get messages
  const messages = await getConversationMessages(conversationId, auth.user.id);

  return successResponse({
    conversation: {
      id: conversation.id,
      caseId: conversation.caseId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    },
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}, { rateLimit: 'STANDARD' });

/**
 * PATCH /api/chat/[conversationId]
 *
 * Update conversation (e.g., title).
 */
export const PATCH = withAuth(async (request, context, auth) => {
  const { conversationId } = await context.params!;

  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  let validated;
  try {
    validated = updateConversationSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(err.issues[0].message, 400);
    }
    throw err;
  }

  // Verify conversation exists and belongs to user BEFORE writing
  const existing = await getConversation(conversationId, auth.user.id);
  if (!existing) {
    return errorResponse('Conversation not found', 404);
  }

  await updateConversationTitle(conversationId, auth.user.id, validated.title);

  // Re-fetch to get the updated title and timestamps
  const updated = await getConversation(conversationId, auth.user.id);
  const conversation = updated ?? existing;

  return successResponse({
    conversation: {
      id: conversation.id,
      caseId: conversation.caseId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    },
  });
}, { rateLimit: 'STANDARD' });

/**
 * DELETE /api/chat/[conversationId]
 *
 * Delete a conversation.
 */
export const DELETE = withAuth(async (_request, context, auth) => {
  const { conversationId } = await context.params!;

  await deleteConversation(conversationId, auth.user.id);

  return successResponse({ deleted: true });
}, { rateLimit: 'SENSITIVE' });
