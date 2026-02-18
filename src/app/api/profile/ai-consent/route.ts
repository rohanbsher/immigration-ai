import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';

const log = createLogger('api:ai-consent');

/**
 * GET /api/profile/ai-consent
 * Check AI consent status for the authenticated user.
 */
export const GET = withAuth(async (_request, _context, auth) => {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('ai_consent_granted_at')
    .eq('id', auth.user.id)
    .single();

  if (error) {
    log.logError('Failed to check AI consent', error);
    return errorResponse('Failed to check consent', 500);
  }

  return successResponse({
    consented: !!profile?.ai_consent_granted_at,
    consentedAt: profile?.ai_consent_granted_at || null,
  });
});

/**
 * POST /api/profile/ai-consent
 * Grant AI consent — sets ai_consent_granted_at on the caller's profile.
 */
export const POST = withAuth(async (_request, _context, auth) => {
  // Rate limit by user ID (not IP) to avoid shared-IP collisions
  const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, auth.user.id);
  if (!rateLimitResult.success) {
    return errorResponse('Too many requests', 429);
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ ai_consent_granted_at: new Date().toISOString() })
    .eq('id', auth.user.id);

  if (error) {
    log.logError('Failed to grant AI consent', error);
    return errorResponse('Failed to update consent', 500);
  }

  return successResponse({ message: 'AI consent granted' });
}, { rateLimit: false });

/**
 * DELETE /api/profile/ai-consent
 * Revoke AI consent — sets ai_consent_granted_at to NULL.
 */
export const DELETE = withAuth(async (_request, _context, auth) => {
  // Rate limit by user ID (not IP) to avoid shared-IP collisions
  const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, auth.user.id);
  if (!rateLimitResult.success) {
    return errorResponse('Too many requests', 429);
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ ai_consent_granted_at: null })
    .eq('id', auth.user.id);

  if (error) {
    log.logError('Failed to revoke AI consent', error);
    return errorResponse('Failed to update consent', 500);
  }

  return successResponse({ message: 'AI consent revoked' });
}, { rateLimit: false });
