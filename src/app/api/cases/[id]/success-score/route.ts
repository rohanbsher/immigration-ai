import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateSuccessScore } from '@/lib/scoring/success-probability';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { requireAiConsent } from '@/lib/auth/api-helpers';

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
