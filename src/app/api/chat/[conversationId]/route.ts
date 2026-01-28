import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getConversation,
  getConversationMessages,
  deleteConversation,
  updateConversationTitle,
} from '@/lib/db/conversations';

interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

/**
 * GET /api/chat/[conversationId]
 *
 * Get a conversation and its messages.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { conversationId } = await params;
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

    // Get conversation
    const conversation = await getConversation(conversationId, user.id);
    if (!conversation) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await getConversationMessages(conversationId, user.id);

    return NextResponse.json({
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
  } catch (error) {
    console.error('Error fetching conversation:', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chat/[conversationId]
 *
 * Update conversation (e.g., title).
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { conversationId } = await params;
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

    const body = await request.json();
    const { title } = body as { title?: string };

    if (title !== undefined) {
      await updateConversationTitle(conversationId, user.id, title);
    }

    const conversation = await getConversation(conversationId, user.id);

    return NextResponse.json({
      conversation: {
        id: conversation?.id,
        caseId: conversation?.caseId,
        title: conversation?.title,
        createdAt: conversation?.createdAt,
        updatedAt: conversation?.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating conversation:', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/[conversationId]
 *
 * Delete a conversation.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { conversationId } = await params;
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

    await deleteConversation(conversationId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
