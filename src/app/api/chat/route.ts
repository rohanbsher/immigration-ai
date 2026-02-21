import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamChatResponse, type ChatMessage } from '@/lib/ai/chat';
import {
  createConversation,
  getConversation,
  getConversationMessages,
  addMessage,
  updateMessage,
} from '@/lib/db/conversations';
import { createLogger } from '@/lib/logger';
import { createSSEStream, SSE_CONFIG } from '@/lib/api/sse';
import { enforceQuota, trackUsage } from '@/lib/billing/quota';
import { handleQuotaError } from '@/lib/billing/quota-error';
import { z } from 'zod';
import { logAIRequest } from '@/lib/audit/ai-audit';
import { withAuth, requireAiConsent, safeParseBody, errorResponse, successResponse } from '@/lib/auth/api-helpers';

const log = createLogger('api:chat');

/**
 * POST /api/chat
 *
 * Send a message and get streaming AI response.
 *
 * Request body:
 * {
 *   "conversationId"?: string,  // Existing conversation to continue
 *   "caseId"?: string,          // Case context (for new conversations)
 *   "message": string           // User's message
 * }
 *
 * Response:
 * Server-Sent Events stream with assistant response
 */
export const POST = withAuth(async (request, _context, auth) => {
  // AI consent check
  const consentError = await requireAiConsent(auth.user.id);
  if (consentError) return consentError;

  // Quota enforcement
  try {
    await enforceQuota(auth.user.id, 'ai_requests');
  } catch (error) {
    const qr = handleQuotaError(error, 'ai_requests');
    if (qr) return qr;
    throw error;
  }

  // Parse and validate request body
  const chatSchema = z.object({
    conversationId: z.string().uuid().nullable().optional().transform(v => v ?? undefined),
    caseId: z.string().uuid().nullable().optional().transform(v => v ?? undefined),
    message: z.string().min(1, 'Message cannot be empty').max(4000),
  });

  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const parseResult = chatSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Bad Request', message: parseResult.error.issues[0].message },
      { status: 400 }
    );
  }

  const { conversationId, caseId, message } = parseResult.data;
  const trimmedMessage = message.trim();

  if (trimmedMessage.length < 1) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Message cannot be empty' },
      { status: 400 }
    );
  }

  // Get or create conversation
  let conversation;
  let activeCaseId = caseId;

  if (conversationId) {
    conversation = await getConversation(conversationId, auth.user.id);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Conversation not found' },
        { status: 404 }
      );
    }
    activeCaseId = conversation.caseId;
  } else {
    conversation = await createConversation(auth.user.id, caseId);
  }

  // Get conversation history and add user message
  const existingMessages = await getConversationMessages(conversation.id, auth.user.id);
  await addMessage(conversation.id, auth.user.id, 'user', trimmedMessage);

  // Build message history for AI
  const messages: ChatMessage[] = [
    ...existingMessages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
    {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: trimmedMessage,
      createdAt: new Date().toISOString(),
    },
  ];

  // Create placeholder message BEFORE streaming to prevent data loss on disconnect
  const assistantMessage = await addMessage(
    conversation.id,
    auth.user.id,
    'assistant',
    '',
    { status: 'streaming' }
  );

  const logContext = {
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    userId: auth.user.id,
  };

  // Stream the response - error handling is inside the handler
  // so we have access to fullResponse for saving partial content
  return createSSEStream(async (sse) => {
    let fullResponse = '';

    try {
      // Send conversation ID immediately (resets timeout)
      sse.send({ type: 'conversation', id: conversation.id });

      // Stream AI response
      for await (const chunk of streamChatResponse(messages, auth.user.id, activeCaseId)) {
        fullResponse += chunk;
        sse.send({ type: 'content', text: chunk });
      }

      // Mark message as complete with full content
      await updateMessage(assistantMessage.id, {
        content: fullResponse,
        status: 'complete',
      });

      sse.send({ type: 'done' });

      logAIRequest({
        operation: 'chat',
        provider: 'anthropic',
        userId: auth.user.id,
        caseId: activeCaseId,
        dataFieldsSent: ['message_content', 'conversation_history', 'case_context'],
        model: 'claude-sonnet-4-20250514',
      });

      trackUsage(auth.user.id, 'ai_requests').catch((err) => {
        log.warn('Usage tracking failed', { error: err instanceof Error ? err.message : String(err) });
      });
    } catch (error) {
      log.logError('Chat streaming error', error, logContext);

      // Save partial response (or error placeholder) with error status
      try {
        await updateMessage(assistantMessage.id, {
          content: fullResponse || '[Error: Response generation failed]',
          status: 'error',
        });
      } catch (updateErr) {
        log.logError('Failed to save error state', updateErr, logContext);
      }

      sse.error('Failed to generate response');
    }
  }, {
    // Use aggressive keepalive for Vercel free tier (25s timeout)
    // This ensures at least one keepalive before timeout
    keepaliveIntervalMs: SSE_CONFIG.VERCEL_FREE_KEEPALIVE_MS,
  });
}, { rateLimit: 'AI_CHAT' });

/**
 * GET /api/chat
 *
 * Get conversations for the current user.
 *
 * Query params:
 * - caseId: Filter by case
 * - limit: Max results (default 20)
 *
 * Response:
 * { conversations: [...] }
 */
export const GET = withAuth(async (request, _context, auth) => {
  const supabase = await createClient();

  const searchParams = request.nextUrl.searchParams;
  const caseId = searchParams.get('caseId') || undefined;
  // Clamp limit between 1 and 100 to prevent DoS via excessive limit
  const rawLimit = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 100);

  // Build query - filter by caseId in database if provided (not in memory)
  let query = supabase
    .from('conversations')
    .select(`
      id,
      case_id,
      title,
      created_at,
      updated_at
    `)
    .eq('user_id', auth.user.id);

  if (caseId) {
    query = query.eq('case_id', caseId);
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const conversations = data || [];

  return successResponse({
    conversations: conversations.map(c => ({
      id: c.id,
      caseId: c.case_id,
      title: c.title,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
  });
}, { rateLimit: 'STANDARD' });
