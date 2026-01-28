import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { streamChatResponse, type ChatMessage } from '@/lib/ai/chat';
import {
  createConversation,
  getConversation,
  getConversationMessages,
  addMessage,
} from '@/lib/db/conversations';

const rateLimiter = createRateLimiter(RATE_LIMITS.AI_CHAT);

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

    // Rate limiting
    const limitResult = await rateLimiter.limit(request, user.id);
    if (!limitResult.allowed) {
      return limitResult.response;
    }

    // Parse request body
    const body = await request.json();
    const { conversationId, caseId, message } = body as {
      conversationId?: string;
      caseId?: string;
      message: string;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Message is required' },
        { status: 400 }
      );
    }

    // Limit message length
    const trimmedMessage = message.trim().slice(0, 4000);

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

    // Get conversation history
    const existingMessages = await getConversationMessages(conversation.id, user.id);

    // Add user message
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

    // Create streaming response
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send conversation ID first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'conversation', id: conversation.id })}\n\n`
            )
          );

          // Stream AI response
          for await (const chunk of streamChatResponse(messages, user.id, activeCaseId)) {
            fullResponse += chunk;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'content', text: chunk })}\n\n`
              )
            );
          }

          // Save assistant response
          await addMessage(conversation.id, user.id, 'assistant', fullResponse);

          // Send done signal
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done' })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          console.error('Chat streaming error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: 'Failed to generate response' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat API:', error);

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

    const searchParams = request.nextUrl.searchParams;
    const caseId = searchParams.get('caseId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get conversations
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        case_id,
        title,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    // Filter by caseId if provided
    const conversations = caseId
      ? (data || []).filter(c => c.case_id === caseId)
      : data || [];

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
    console.error('Error fetching conversations:', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
