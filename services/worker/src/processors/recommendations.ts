/**
 * Recommendations Worker Processor
 *
 * Processes recommendation jobs: fetches case context, runs Claude
 * for next-step suggestions, and caches results in the database.
 */

import { Job } from 'bullmq';
import type { RecommendationsJob } from '@/lib/jobs/types';
import { suggestNextSteps } from '@/lib/ai/anthropic';
import { analyzeDocumentCompleteness } from '@/lib/ai/document-completeness';
import { withAIFallback } from '@/lib/ai/utils';
import { anthropicBreaker } from '@/lib/ai/circuit-breaker';
import { getWorkerSupabase } from '../supabase';
import { trackUsage } from '../track-usage';

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  reason: string;
  category: 'document' | 'form' | 'deadline' | 'review' | 'other';
  actionUrl?: string;
}

function inferCategory(action: string): Recommendation['category'] {
  const lower = action.toLowerCase();
  if (lower.includes('upload') || lower.includes('document') || lower.includes('passport') || lower.includes('certificate')) return 'document';
  if (lower.includes('form') || lower.includes('fill') || lower.includes('complete')) return 'form';
  if (lower.includes('deadline') || lower.includes('due') || lower.includes('expir')) return 'deadline';
  if (lower.includes('review') || lower.includes('verify') || lower.includes('check')) return 'review';
  return 'other';
}

function generateActionUrl(caseId: string, category: Recommendation['category']): string {
  switch (category) {
    case 'document': return `/dashboard/cases/${caseId}/documents`;
    case 'form': return `/dashboard/cases/${caseId}/forms`;
    default: return `/dashboard/cases/${caseId}`;
  }
}

async function generateRecommendations(
  caseId: string
): Promise<Recommendation[]> {
  const supabase = getWorkerSupabase();

  const [caseResult, docsResult, formsResult] = await Promise.all([
    supabase.from('cases').select('visa_type, status').eq('id', caseId).single(),
    supabase.from('documents').select('document_type').eq('case_id', caseId).is('deleted_at', null),
    supabase.from('forms').select('form_type').eq('case_id', caseId).is('deleted_at', null),
  ]);

  if (caseResult.error || !caseResult.data) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const aiResult = await anthropicBreaker.execute(() =>
    suggestNextSteps({
      visa_type: caseResult.data.visa_type,
      status: caseResult.data.status,
      documents: (docsResult.data || []).map((d) => d.document_type),
      forms_completed: (formsResult.data || []).map((f) => f.form_type),
    })
  );

  return aiResult.nextSteps.map((step, index) => {
    const category = inferCategory(step.action);
    return {
      id: `rec_${caseId}_${index}_${Date.now()}`,
      priority: step.priority,
      action: step.action,
      reason: step.reason,
      category,
      actionUrl: generateActionUrl(caseId, category),
    };
  });
}

async function generateFallbackRecommendations(
  caseId: string
): Promise<Recommendation[]> {
  const supabase = getWorkerSupabase();
  try {
    // Cast needed: worker and main project have different @supabase/supabase-js minor versions
    const completeness = await analyzeDocumentCompleteness(caseId, supabase as any);
    const recommendations: Recommendation[] = [];

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

function sortByPriority(recs: Recommendation[]): Recommendation[] {
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...recs].sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2));
}

export async function processRecommendations(
  job: Job<RecommendationsJob>
): Promise<{ caseId: string; count: number; source: string }> {
  const { caseId } = job.data;
  const supabase = getWorkerSupabase();

  await job.updateProgress(10);

  // Generate recommendations with AI fallback
  const { result: recommendations, source } = await withAIFallback(
    () => generateRecommendations(caseId),
    () => generateFallbackRecommendations(caseId)
  );

  await job.updateProgress(80);

  const sorted = sortByPriority(recommendations);
  const now = new Date();

  // Store recommendations in the case metadata for the API route to read
  const { error: updateError } = await supabase
    .from('cases')
    .update({
      ai_recommendations: {
        caseId,
        recommendations: sorted,
        generatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        source,
      },
      updated_at: now.toISOString(),
    })
    .eq('id', caseId);

  if (updateError) {
    throw new Error(`Failed to store recommendations for case ${caseId}: ${updateError.message}`);
  }

  // Only track usage when AI was actually used (not fallback)
  if (source === 'ai') {
    trackUsage(job.data.userId, 'ai_requests').catch(() => {});
  }

  await job.updateProgress(100);

  return {
    caseId,
    count: sorted.length,
    source,
  };
}
