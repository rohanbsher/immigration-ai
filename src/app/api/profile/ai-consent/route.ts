import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:ai-consent');

/**
 * GET /api/profile/ai-consent
 * Check AI consent status for the authenticated user.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('ai_consent_granted_at')
      .eq('id', user.id)
      .single();

    if (error) {
      log.logError('Failed to check AI consent', error);
      return NextResponse.json({ error: 'Failed to check consent' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        consented: !!profile?.ai_consent_granted_at,
        consentedAt: profile?.ai_consent_granted_at || null,
      },
    });
  } catch (error) {
    log.logError('Error checking AI consent', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/profile/ai-consent
 * Grant AI consent — sets ai_consent_granted_at on the caller's profile.
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit by user ID (not IP) to avoid shared-IP collisions
    const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ai_consent_granted_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      log.logError('Failed to grant AI consent', error);
      return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
    }

    return NextResponse.json({ message: 'AI consent granted' });
  } catch (error) {
    log.logError('Error granting AI consent', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/ai-consent
 * Revoke AI consent — sets ai_consent_granted_at to NULL.
 */
export async function DELETE(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit by user ID (not IP) to avoid shared-IP collisions
    const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ai_consent_granted_at: null })
      .eq('id', user.id);

    if (error) {
      log.logError('Failed to revoke AI consent', error);
      return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
    }

    return NextResponse.json({ message: 'AI consent revoked' });
  } catch (error) {
    log.logError('Error revoking AI consent', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
