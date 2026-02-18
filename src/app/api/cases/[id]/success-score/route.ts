import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateSuccessScore } from '@/lib/scoring/success-probability';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { requireAiConsent } from '@/lib/auth/api-helpers';
import { features } from '@/lib/config';
import { enqueueSuccessScore } from '@/lib/jobs/queues';
import { enforceQuota, trackUsage, QuotaExceededError } from '@/lib/billing/quota';

const log = createLogger('api:success-score');

const rateLimiter = createRateLimiter(RATE_LIMITS.AI_SUCCESS_SCORE);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/success-score
 *
 * Calculates success probability score for a case.
 * Returns overall score, factors breakdown, risk factors, and improvements.
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

    // Verify user has access to this case
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

    // Check if user is attorney or client for this case
    if (caseData.attorney_id !== user.id && caseData.client_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this case' },
        { status: 403 }
      );
    }

    // Async path: enqueue job when worker is enabled
    if (features.workerEnabled) {
      // Check DB cache for fresh success score
      const { data: caseWithCache } = await supabase
        .from('cases')
        .select('ai_success_score')
        .eq('id', caseId)
        .single();

      if (caseWithCache?.ai_success_score) {
        const cached = caseWithCache.ai_success_score as Record<string, unknown>;
        const calculatedAt = cached.calculatedAt as string | undefined;
        if (calculatedAt && Date.now() - new Date(calculatedAt).getTime() < 60 * 60 * 1000) {
          const response = NextResponse.json({ ...cached, source: 'db-cache' });
          response.headers.set('Cache-Control', 'private, max-age=3600');
          return response;
        }
      }

      // Enforce quota before enqueueing
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

      try {
        const job = await enqueueSuccessScore({
          caseId,
          userId: user.id,
        });

        trackUsage(user.id, 'ai_requests').catch((err) => {
          log.warn('Usage tracking failed', { error: err instanceof Error ? err.message : String(err) });
        });

        return NextResponse.json(
          { jobId: job.id, status: 'queued', message: 'Success score calculation has been queued.' },
          { status: 202 }
        );
      } catch (enqueueErr) {
        log.warn('Failed to enqueue success-score job, falling back to sync', {
          error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
        });
        // Fall through to synchronous path below
      }
    }

    // Calculate success score
    let result;
    try {
      result = await calculateSuccessScore(caseId);
    } catch (calcError) {
      log.warn('Success score calculation failed, returning defaults', {
        error: calcError instanceof Error ? calcError.message : String(calcError),
      });

      // Return a sensible default instead of failing
      result = {
        overallScore: 0,
        confidence: 0,
        factors: [],
        riskFactors: [],
        improvements: ['Upload documents and create forms to see your success score.'],
        calculatedAt: new Date().toISOString(),
        degraded: true,
      };
    }

    // Add cache headers (score is relatively stable, cache for 1 hour)
    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'private, max-age=3600');

    return response;
  } catch (error) {
    log.logError('Error calculating success score', error);

    // Even for unexpected errors, return a degraded result instead of 500
    return NextResponse.json({
      overallScore: 0,
      confidence: 0,
      factors: [],
      riskFactors: [],
      improvements: [],
      calculatedAt: new Date().toISOString(),
      degraded: true,
    });
  }
}
