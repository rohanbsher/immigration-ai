import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverAuth } from '@/lib/auth';
import {
  createInvitation,
  getPendingInvitations,
  revokeInvitation,
  getUserRole,
  getFirmMember,
} from '@/lib/db/firms';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { canManageMembers } from '@/types/firms';
import { createLogger } from '@/lib/logger';
import { sendTeamInvitationEmail } from '@/lib/email/notifications';
import { getFirmById } from '@/lib/db/firms';
import { safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:firms-invitations');

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'attorney', 'staff']),
});

const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = await getUserRole(user.id, id);
    if (!userRole || !canManageMembers(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invitations = await getPendingInvitations(id);

    return NextResponse.json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    log.logError('Get invitations error', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = await getUserRole(user.id, id);
    if (!userRole || !canManageMembers(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const validation = createInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role } = validation.data;

    // Check if invitee is already a member by looking up their profile by email
    // Normalize email consistently (trim + lowercase) to match invitation storage
    const supabase = await (await import('@/lib/supabase/server')).createClient();
    const { data: inviteeProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (inviteeProfile) {
      const existingMember = await getFirmMember(id, inviteeProfile.id);
      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this firm' },
          { status: 400 }
        );
      }
    }

    const invitation = await createInvitation(id, email, role, user.id);

    // Send invitation email (fire-and-forget)
    const firm = await getFirmById(id);
    const inviterProfile = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();
    const inviterName = inviterProfile.data
      ? `${inviterProfile.data.first_name || ''} ${inviterProfile.data.last_name || ''}`.trim() || 'A team member'
      : 'A team member';

    sendTeamInvitationEmail(
      email,
      inviterName,
      firm?.name || 'your firm',
      role,
      invitation.token,
      new Date(invitation.expiresAt)
    ).catch((err) => log.logError('Failed to send invitation email', err));

    return NextResponse.json({
      success: true,
      data: invitation,
    }, { status: 201 });
  } catch (error) {
    log.logError('Create invitation error', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.STANDARD, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = await getUserRole(user.id, id);
    if (!userRole || !canManageMembers(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const validation = revokeInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    await revokeInvitation(validation.data.invitationId);

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked successfully',
    });
  } catch (error) {
    log.logError('Revoke invitation error', error);
    return NextResponse.json(
      { error: 'Failed to revoke invitation' },
      { status: 500 }
    );
  }
}
