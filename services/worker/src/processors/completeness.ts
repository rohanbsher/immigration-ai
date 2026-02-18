/**
 * Document Completeness Worker Processor
 *
 * Processes completeness analysis jobs: calls analyzeDocumentCompleteness
 * with the worker's Supabase client and stores results on the case.
 */

import { Job } from 'bullmq';
import type { CompletenessJob } from '@/lib/jobs/types';
import { analyzeDocumentCompleteness } from '@/lib/ai/document-completeness';
import { getWorkerSupabase } from '../supabase';

export async function processCompleteness(
  job: Job<CompletenessJob>
): Promise<{ caseId: string; completeness: number; readiness: string }> {
  const { caseId } = job.data;
  const supabase = getWorkerSupabase();

  await job.updateProgress(10);

  // Run completeness analysis, passing worker's admin client
  // Cast needed: worker and main project have different @supabase/supabase-js minor versions
  const result = await analyzeDocumentCompleteness(caseId, supabase as any);

  await job.updateProgress(80);

  // Store result on the case for the API route to read
  const { error: updateError } = await supabase
    .from('cases')
    .update({
      ai_completeness: {
        ...result,
        analyzedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', caseId);

  if (updateError) {
    throw new Error(`Failed to store completeness for case ${caseId}: ${updateError.message}`);
  }

  await job.updateProgress(100);

  return {
    caseId,
    completeness: result.overallCompleteness,
    readiness: result.filingReadiness,
  };
}
