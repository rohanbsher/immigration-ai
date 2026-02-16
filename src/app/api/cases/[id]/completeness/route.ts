import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeDocumentCompleteness } from '@/lib/ai/document-completeness';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { requireAiConsent } from '@/lib/auth/api-helpers';

const log = createLogger('api:document-completeness');

const rateLimiter = createRateLimiter(RATE_LIMITS.AI_COMPLETENESS);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/completeness
 *
 * Analyzes document completeness for a case.
 * Returns missing documents, uploaded documents, and recommendations.
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

    // Perform completeness analysis
    let result;
    try {
      result = await analyzeDocumentCompleteness(caseId);
    } catch (analysisError) {
      if (analysisError instanceof Error && analysisError.message === 'Case not found') {
        return NextResponse.json(
          { error: 'Not Found', message: 'Case not found' },
          { status: 404 }
        );
      }

      log.warn('Completeness analysis failed, returning defaults', {
        error: analysisError instanceof Error ? analysisError.message : String(analysisError),
      });

      // Return a sensible default instead of failing
      result = {
        overallCompleteness: 0,
        filingReadiness: 'incomplete' as const,
        missingRequired: [],
        missingOptional: [],
        uploadedDocs: [],
        recommendations: ['Upload documents to see completeness analysis.'],
        totalRequired: 0,
        uploadedRequired: 0,
        analyzedAt: new Date().toISOString(),
        degraded: true,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    log.logError('Error analyzing document completeness', error);

    // Even for unexpected errors, return a degraded result instead of 500
    return NextResponse.json({
      overallCompleteness: 0,
      filingReadiness: 'incomplete',
      missingRequired: [],
      missingOptional: [],
      uploadedDocs: [],
      recommendations: [],
      totalRequired: 0,
      uploadedRequired: 0,
      analyzedAt: new Date().toISOString(),
      degraded: true,
    });
  }
}
