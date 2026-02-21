import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';

const log = createLogger('api:ai-consent');

/**
 * Current consent version. Bump this when the AI processing scope changes
 * (e.g., new providers, new data types, changed retention policies).
 * Users with an older stored version will see `needsReconsent: true`.
 */
const AI_CONSENT_VERSION = 1;

/**
 * Describes exactly what the attorney is consenting to.
 * Displayed on the consent UI so attorneys know what they're agreeing to.
 */
const AI_CONSENT_SCOPE = {
  version: AI_CONSENT_VERSION,
  providers: ['anthropic', 'openai'] as const,
  dataTypes: [
    'document_images',
    'extracted_text',
    'case_metadata',
    'chat_messages',
  ] as const,
  processingActivities: [
    'document_analysis',
    'text_extraction',
    'form_autofill',
    'case_recommendations',
    'chat_assistance',
  ] as const,
  retentionPolicy:
    'No client data is retained by AI providers after processing.',
  optOutEffect:
    'AI-powered features will be disabled. Manual data entry will still work.',
};

/**
 * GET /api/profile/ai-consent
 * Check AI consent status, including whether re-consent is needed.
 */
export const GET = withAuth(async (_request, _context, auth) => {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('ai_consent_granted_at, ai_consent_version')
    .eq('id', auth.user.id)
    .single();

  if (error) {
    log.logError('Failed to check AI consent', error);
    return errorResponse('Failed to check consent', 500);
  }

  const storedVersion = profile?.ai_consent_version ?? 0;
  const consented = !!profile?.ai_consent_granted_at;
  const needsReconsent = consented && storedVersion < AI_CONSENT_VERSION;

  return successResponse({
    consented,
    consentedAt: profile?.ai_consent_granted_at || null,
    consentVersion: storedVersion,
    currentVersion: AI_CONSENT_VERSION,
    needsReconsent,
    scope: AI_CONSENT_SCOPE,
  });
});

/**
 * POST /api/profile/ai-consent
 * Grant AI consent — sets timestamp and version on the caller's profile.
 */
export const POST = withAuth(async (_request, _context, auth) => {
  // Rate limit by user ID (not IP) to avoid shared-IP collisions
  const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, auth.user.id);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      ai_consent_granted_at: new Date().toISOString(),
      ai_consent_version: AI_CONSENT_VERSION,
    })
    .eq('id', auth.user.id);

  if (error) {
    log.logError('Failed to grant AI consent', error);
    return errorResponse('Failed to update consent', 500);
  }

  return successResponse({ message: 'AI consent granted', version: AI_CONSENT_VERSION });
}, { rateLimit: false });

/**
 * DELETE /api/profile/ai-consent
 * Revoke AI consent — clears timestamp and resets version to 0.
 */
export const DELETE = withAuth(async (_request, _context, auth) => {
  // Rate limit by user ID (not IP) to avoid shared-IP collisions
  const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, auth.user.id);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      ai_consent_granted_at: null,
      ai_consent_version: 0,
    })
    .eq('id', auth.user.id);

  if (error) {
    log.logError('Failed to revoke AI consent', error);
    return errorResponse('Failed to update consent', 500);
  }

  return successResponse({ message: 'AI consent revoked' });
}, { rateLimit: false });
