import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assessRFERisk } from '@/lib/ai/rfe';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { requireAiConsent } from '@/lib/auth/api-helpers';
import { enforceQuota, trackUsage } from '@/lib/billing/quota';
import { handleQuotaError } from '@/lib/billing/quota-error';

const log = createLogger('api:rfe-assessment');

const rateLimiter = createRateLimiter(RATE_LIMITS.AI_SUCCESS_SCORE);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/rfe-assessment
 *
 * Returns RFE risk assessment for a case.
 * Serves cached result if fresh (< 1 hour), otherwise runs new assessment.
 * Phase 1: deterministic rules only, no AI calls, runs in <100ms.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { id: caseId } = await params;

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

    // Verify user has access to this case (inline IDOR check)
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, attorney_id, client_id')
      .eq('id', caseId)
      .is('deleted_at', null)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Case not found' },
        { status: 404 }
      );
    }

    if (caseData.attorney_id !== user.id && caseData.client_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this case' },
        { status: 403 }
      );
    }

    // Check for cached assessment
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    if (!forceRefresh) {
      const { data: caseWithCache } = await supabase
        .from('cases')
        .select('rfe_assessment, rfe_assessed_at')
        .eq('id', caseId)
        .single();

      if (caseWithCache?.rfe_assessment && caseWithCache.rfe_assessed_at) {
        const assessedAt = new Date(caseWithCache.rfe_assessed_at);
        const ageMs = Date.now() - assessedAt.getTime();
        const ONE_HOUR = 60 * 60 * 1000;

        if (ageMs < ONE_HOUR) {
          const response = NextResponse.json({
            ...(caseWithCache.rfe_assessment as Record<string, unknown>),
            source: 'db-cache',
          });
          response.headers.set('Cache-Control', 'private, max-age=3600');
          return response;
        }
      }
    }

    // Enforce quota before running assessment
    try {
      await enforceQuota(user.id, 'ai_requests');
    } catch (error) {
      const qr = handleQuotaError(error, 'ai_requests');
      if (qr) return qr;
      throw error;
    }

    // Track usage (fire-and-forget)
    trackUsage(user.id, 'ai_requests').catch((err) => {
      log.warn('Usage tracking failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Run fresh assessment (sync — deterministic rules, <100ms)
    const result = await assessRFERisk(caseId, 'manual', supabase);

    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'private, max-age=3600');
    return response;
  } catch (error) {
    log.logError('RFE assessment failed', error);

    // Degraded response — don't crash the UI
    return NextResponse.json({
      rfeRiskScore: 0,
      riskLevel: 'low',
      triggeredRules: [],
      safeRuleIds: [],
      priorityActions: [],
      dataConfidence: 0,
      assessedAt: new Date().toISOString(),
      degraded: true,
    });
  }
}
