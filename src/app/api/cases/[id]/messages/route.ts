import { NextRequest, NextResponse } from 'next/server';
import { caseMessagesService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { standardRateLimiter } from '@/lib/rate-limit';
import { sendCaseUpdateEmail } from '@/lib/email/notifications';

const log = createLogger('api:case-messages');

const createMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(10000, 'Message too long'),
});

/**
 * Verify user has access to this case (is attorney, client, or admin)
 */
async function verifyCaseAccess(userId: string, caseId: string): Promise<boolean> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return false;

  // Check if user is attorney or client for this case
  if (caseData.attorney_id === userId || caseData.client_id === userId) {
    return true;
  }

  // Check if user is admin
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return profile?.role === 'admin';
}

/**
 * GET /api/cases/[id]/messages - Get all messages for a case
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

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Verify user has access to this case
    const hasAccess = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get pagination params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { data: messages, total } = await caseMessagesService.getMessages(caseId, {
      limit,
      offset,
    });

    // Mark messages as read for the current user
    await caseMessagesService.markAllAsRead(caseId, user.id);

    return NextResponse.json({
      data: messages,
      total,
      limit,
      offset,
    });
  } catch (error) {
    log.logError('Failed to fetch messages', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cases/[id]/messages - Send a new message
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

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Verify user has access to this case
    const hasAccess = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createMessageSchema.parse(body);

    const message = await caseMessagesService.createMessage({
      case_id: caseId,
      sender_id: user.id,
      content: validatedData.content,
    });

    log.info('Message sent', { caseId, senderId: user.id, messageId: message.id });

    // Notify the other party (fire-and-forget)
    sendCaseUpdateEmail(caseId, 'note_added', 'New message received', user.id)
      .catch((err) => log.logError('Failed to send message notification', err));

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    log.logError('Failed to send message', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
