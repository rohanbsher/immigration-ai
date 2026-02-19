/**
 * Success Score Worker Processor
 *
 * Processes success score jobs: calls calculateSuccessScore
 * with the worker's Supabase client and stores results on the case.
 */

import { Job } from 'bullmq';
import type { SuccessScoreJob } from '@/lib/jobs/types';
import { calculateSuccessScore } from '@/lib/scoring/success-probability';
import { getWorkerSupabase } from '../supabase';
import { trackUsage } from '../track-usage';

export async function processSuccessScore(
  job: Job<SuccessScoreJob>
): Promise<{ caseId: string; score: number; confidence: number }> {
  const { caseId } = job.data;
  const supabase = getWorkerSupabase();

  await job.updateProgress(10);

  // Calculate success score, passing worker's admin client
  // Cast needed: worker and main project have different @supabase/supabase-js minor versions
  const result = await calculateSuccessScore(caseId, supabase as any);

  await job.updateProgress(80);

  // Store result on the case for the API route to read
  const { error: updateError } = await supabase
    .from('cases')
    .update({
      ai_success_score: {
        ...result,
        calculatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', caseId);

  if (updateError) {
    throw new Error(`Failed to store success score for case ${caseId}: ${updateError.message}`);
  }

  trackUsage(job.data.userId, 'ai_requests').catch(() => {});

  await job.updateProgress(100);

  return {
    caseId,
    score: result.overallScore,
    confidence: result.confidence,
  };
}
