import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { suggestNextSteps } from '@/lib/ai/anthropic';
import { analyzeDocumentCompleteness } from '@/lib/ai/document-completeness';
import {
  getCachedRecommendations,
  cacheRecommendations,
  markRecommendationComplete,
  dismissRecommendation,
  filterActiveRecommendations,
  sortRecommendationsByPriority,
  type Recommendation,
  type CachedRecommendations,
} from '@/lib/db/recommendations';
import { createRateLimiter, RATE_LIMITS } from '@/lib/rate-limit';
import { withAIFallback } from '@/lib/ai/utils';
import { createLogger } from '@/lib/logger';
import { enforceQuota, trackUsage, QuotaExceededError } from '@/lib/billing/quota';
import { requireAiConsent, safeParseBody } from '@/lib/auth/api-helpers';
import { features } from '@/lib/config';
import { enqueueRecommendations } from '@/lib/jobs/queues';

const log = createLogger('api:case-recommendations');

const rateLimiter = createRateLimiter(RATE_LIMITS.AI_RECOMMENDATIONS);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Map category from action text.
 */
function inferCategory(action: string): Recommendation['category'] {
  const lowerAction = action.toLowerCase();

  if (
    lowerAction.includes('upload') ||
    lowerAction.includes('document') ||
    lowerAction.includes('passport') ||
    lowerAction.includes('certificate')
  ) {
    return 'document';
  }

  if (
    lowerAction.includes('form') ||
    lowerAction.includes('fill') ||
    lowerAction.includes('complete')
  ) {
    return 'form';
  }

  if (
    lowerAction.includes('deadline') ||
    lowerAction.includes('due') ||
    lowerAction.includes('expir')
  ) {
    return 'deadline';
  }

  if (
    lowerAction.includes('review') ||
    lowerAction.includes('verify') ||
    lowerAction.includes('check')
  ) {
    return 'review';
  }

  return 'other';
}

/**
 * Generate action URL based on recommendation.
 */
function generateActionUrl(
  caseId: string,
  action: string,
  category: Recommendation['category']
): string {
  switch (category) {
    case 'document':
      return `/dashboard/cases/${caseId}/documents`;
    case 'form':
      return `/dashboard/cases/${caseId}/forms`;
    case 'review':
      return `/dashboard/cases/${caseId}`;
    default:
      return `/dashboard/cases/${caseId}`;
  }
}

/**
 * Generate recommendations using AI.
 */
async function generateRecommendations(
  caseId: string
): Promise<Recommendation[]> {
  const supabase = await createClient();

  // Fetch case data
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('visa_type, status')
    .eq('id', caseId)
    .single();

  if (caseError || !caseData) {
    throw new Error('Case not found');
  }

  // Fetch documents
  const { data: documents } = await supabase
    .from('documents')
    .select('document_type')
    .eq('case_id', caseId)
    .is('deleted_at', null);

  // Fetch forms (excluding soft-deleted)
  const { data: forms } = await supabase
    .from('forms')
    .select('form_type')
    .eq('case_id', caseId)
    .is('deleted_at', null);

  // Call AI to suggest next steps
  const aiResult = await suggestNextSteps({
    visa_type: caseData.visa_type,
    status: caseData.status,
    documents: (documents || []).map((d) => d.document_type),
    forms_completed: (forms || []).map((f) => f.form_type),
  });

  // Convert AI response to Recommendation format
  const recommendations: Recommendation[] = aiResult.nextSteps.map(
    (step, index) => {
      const category = inferCategory(step.action);
      return {
        id: `rec_${caseId}_${index}_${Date.now()}`,
        priority: step.priority,
        action: step.action,
        reason: step.reason,
        category,
        actionUrl: generateActionUrl(caseId, step.action, category),
      };
    }
  );

  return recommendations;
}

/**
 * Generate fallback recommendations based on document completeness.
 */
async function generateFallbackRecommendations(
  caseId: string
): Promise<Recommendation[]> {
  try {
    const completeness = await analyzeDocumentCompleteness(caseId);
    const recommendations: Recommendation[] = [];

    // Add recommendations for missing documents
    for (const missing of completeness.missingRequired.slice(0, 3)) {
      recommendations.push({
        id: `rec_fallback_${caseId}_${missing.documentType}`,
        priority: 'high',
        action: `Upload ${missing.displayName}`,
        reason: 'Required document for filing',
        category: 'document',
        actionUrl: `/dashboard/cases/${caseId}/documents?upload=${missing.documentType}`,
      });
    }

    // Add general recommendations from completeness analysis
    for (const rec of completeness.recommendations.slice(0, 2)) {
      recommendations.push({
        id: `rec_fallback_${caseId}_${recommendations.length}`,
        priority: 'medium',
        action: rec,
        reason: 'Suggested action to improve case readiness',
        category: 'other',
        actionUrl: `/dashboard/cases/${caseId}`,
      });
    }

    return recommendations;
  } catch {
    return [];
  }
}

/**
 * GET /api/cases/[id]/recommendations
 *
 * Get AI-generated recommendations for a case.
 * Returns cached recommendations if available.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id: caseId } = await params;

  try {
    const supabase = await createClient();

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

    // Verify user has access to this case (also fetch visa_type + ai_recommendations for async path)
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, attorney_id, client_id, visa_type, ai_recommendations')
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

    // Check URL params for refresh flag
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    // Quota enforcement (only needed if we'll generate fresh recommendations)
    if (forceRefresh || !(await getCachedRecommendations(caseId))) {
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
    }

    // Try to get cached recommendations
    if (!forceRefresh) {
      const cached = await getCachedRecommendations(caseId);
      if (cached) {
        const activeRecs = filterActiveRecommendations(cached.recommendations);
        const sortedRecs = sortRecommendationsByPriority(activeRecs);

        return NextResponse.json({
          ...cached,
          recommendations: sortedRecs,
          source: 'cache',
        } as CachedRecommendations);
      }
    }

    // Async path: enqueue job when worker is enabled
    if (features.workerEnabled) {
      // Return cached DB result if fresh (< 1 hour) and not force-refreshing
      if (!forceRefresh && caseData.ai_recommendations) {
        const cached = caseData.ai_recommendations as CachedRecommendations;
        if (cached.expiresAt && new Date(cached.expiresAt) > new Date()) {
          const activeRecs = filterActiveRecommendations(cached.recommendations || []);
          const sortedRecs = sortRecommendationsByPriority(activeRecs);
          return NextResponse.json({
            ...cached,
            recommendations: sortedRecs,
            source: 'cache',
          } as CachedRecommendations);
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
        const job = await enqueueRecommendations({
          caseId,
          userId: user.id,
          visaType: caseData.visa_type || 'unknown',
        });

        trackUsage(user.id, 'ai_requests').catch((err) => {
          log.warn('Usage tracking failed', { error: err instanceof Error ? err.message : String(err) });
        });

        return NextResponse.json(
          { jobId: job.id, status: 'queued', message: 'Recommendations are being generated.' },
          { status: 202 }
        );
      } catch (enqueueErr) {
        log.warn('Failed to enqueue recommendations job, falling back to sync', {
          error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
        });
        // Fall through to synchronous path below
      }
    }

    // Generate new recommendations with fallback
    const { result: recommendations, source } = await withAIFallback(
      () => generateRecommendations(caseId),
      () => generateFallbackRecommendations(caseId)
    );

    // Track AI usage for freshly generated recommendations
    trackUsage(user.id, 'ai_requests').catch((err) => {
      log.warn('Usage tracking failed', { error: err instanceof Error ? err.message : String(err) });
    });

    // Cache the recommendations
    await cacheRecommendations(caseId, recommendations);

    // Sort by priority
    const sortedRecs = sortRecommendationsByPriority(recommendations);

    const result: CachedRecommendations = {
      caseId,
      recommendations: sortedRecs,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      source,
    };

    return NextResponse.json(result);
  } catch (error) {
    log.logError('Error generating recommendations', error);

    // Return a degraded result instead of 500
    return NextResponse.json({
      caseId,
      recommendations: [],
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      source: 'fallback',
      degraded: true,
    } as CachedRecommendations);
  }
}

/**
 * PATCH /api/cases/[id]/recommendations
 *
 * Update a recommendation (complete or dismiss).
 */
export async function PATCH(
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

    // Parse request body
    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const { recommendationId, action } = body as {
      recommendationId: string;
      action: 'complete' | 'dismiss';
    };

    if (!recommendationId || !action) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing recommendationId or action' },
        { status: 400 }
      );
    }

    // Verify user has access to this case
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, attorney_id')
      .eq('id', caseId)
      .is('deleted_at', null)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Case not found' },
        { status: 404 }
      );
    }

    // Only attorneys can update recommendations
    if (caseData.attorney_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only attorneys can update recommendations' },
        { status: 403 }
      );
    }

    // Update the recommendation
    let success = false;
    if (action === 'complete') {
      success = await markRecommendationComplete(caseId, recommendationId);
    } else if (action === 'dismiss') {
      success = await dismissRecommendation(caseId, recommendationId);
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Recommendation not found in cache' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.logError('Error updating recommendation', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update recommendation' },
      { status: 500 }
    );
  }
}
