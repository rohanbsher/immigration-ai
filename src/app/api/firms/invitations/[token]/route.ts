import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, acceptInvitation } from '@/lib/db/firms';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { withAuth, successResponse, errorResponse, getClientIp } from '@/lib/auth/api-helpers';

const log = createLogger('api:firms-invitation-token');

interface Params {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/firms/invitations/[token]
 *
 * Public endpoint to view invitation details.
 * No auth required — rate limited by IP.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const ip = getClientIp(request);
    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation has been ${invitation.status}` },
        { status: 400 }
      );
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        firm: invitation.firm,
        inviter: invitation.inviter,
      },
    });
  } catch (error) {
    log.logError('Get invitation error', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/firms/invitations/[token]
 *
 * Accept a firm invitation. Requires authentication.
 */
export const POST = withAuth(async (_request, context, auth) => {
  const { token } = await context.params!;

  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return errorResponse('Invitation not found', 404);
  }

  if (invitation.status !== 'pending') {
    return errorResponse(`Invitation has been ${invitation.status}`, 400);
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    return errorResponse('Invitation has expired', 400);
  }

  // Verify invitation email matches authenticated user (trim whitespace for robustness)
  if (invitation.email.trim().toLowerCase() !== auth.user.email?.trim().toLowerCase()) {
    return errorResponse('This invitation was sent to a different email address', 403);
  }

  const member = await acceptInvitation(token, auth.user.id);

  return successResponse(member);
}, { rateLimit: 'SENSITIVE' });
