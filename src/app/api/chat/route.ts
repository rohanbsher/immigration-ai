import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
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
import { enforceQuota, trackUsage, QuotaExceededError } from '@/lib/billing/quota';
import { z } from 'zod';
import { logAIRequest } from '@/lib/audit/ai-audit';
import { requireAiConsent, safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:chat');

const rateLimiter = createRateLimiter(RATE_LIMITS.AI_CHAT);
const standardRateLimiter = createRateLimiter(RATE_LIMITS.STANDARD);

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
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to continue' },
        { status: 401 }
      );
    }

    // AI consent check
    const consentError = await requireAiConsent(user.id);
    if (consentError) return consentError;

    // Rate limiting
    const limitResult = await rateLimiter.limit(request, user.id);
    if (!limitResult.allowed) {
      return limitResult.response;
    }

    // Quota enforcement
    try {
      await enforceQuota(user.id, 'ai_requests');
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return NextResponse.json(
          { error: 'AI request limit reached. Please upgrade your plan.', code: 'QUOTA_EXCEEDED' },
          { status: 402 }
        );
      }
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
      conversation = await getConversation(conversationId, user.id);
      if (!conversation) {
        return NextResponse.json(
          { error: 'Not Found', message: 'Conversation not found' },
          { status: 404 }
        );
      }
      activeCaseId = conversation.caseId;
    } else {
      conversation = await createConversation(user.id, caseId);
    }

    // Get conversation history and add user message
    const existingMessages = await getConversationMessages(conversation.id, user.id);
    await addMessage(conversation.id, user.id, 'user', trimmedMessage);

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
      user.id,
      'assistant',
      '',
      { status: 'streaming' }
    );

    const logContext = {
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      userId: user.id,
    };

    // Stream the response - error handling is inside the handler
    // so we have access to fullResponse for saving partial content
    return createSSEStream(async (sse) => {
      let fullResponse = '';

      try {
        // Send conversation ID immediately (resets timeout)
        sse.send({ type: 'conversation', id: conversation.id });

        // Stream AI response
        for await (const chunk of streamChatResponse(messages, user.id, activeCaseId)) {
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
          userId: user.id,
          caseId: activeCaseId,
          dataFieldsSent: ['message_content', 'conversation_history', 'case_context'],
          model: 'claude-sonnet-4-20250514',
        });

        trackUsage(user.id, 'ai_requests').catch((err) => {
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
  } catch (error) {
    log.logError('Error in chat API', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to process chat' },
      { status: 500 }
    );
  }
}

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
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to continue' },
        { status: 401 }
      );
    }

    // Rate limiting
    const limitResult = await standardRateLimiter.limit(request, user.id);
    if (!limitResult.allowed) {
      return limitResult.response;
    }

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
      .eq('user_id', user.id);

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

    return NextResponse.json({
      conversations: conversations.map(c => ({
        id: c.id,
        caseId: c.case_id,
        title: c.title,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (error) {
    log.logError('Error fetching conversations', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch conversations. Please try again.' },
      { status: 500 }
    );
  }
}
