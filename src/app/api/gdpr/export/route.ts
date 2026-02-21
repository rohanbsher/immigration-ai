import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';

const log = createLogger('api:gdpr-export');

export const GET = withAuth(async (_request, _context, auth) => {
  const supabase = await createClient();

  const { data: jobs, error } = await supabase
    .from('gdpr_export_jobs')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    log.logError('Failed to fetch export jobs', error);
    return errorResponse('Failed to fetch export history', 500);
  }

  return successResponse(jobs || []);
}, { rateLimit: 'SENSITIVE' });

export const POST = withAuth(async (_request, _context, auth) => {
  const supabase = await createClient();

  const { data: existingJob, error: checkError } = await supabase
    .from('gdpr_export_jobs')
    .select('*')
    .eq('user_id', auth.user.id)
    .in('status', ['pending', 'processing'])
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    log.logError('Failed to check existing jobs', checkError);
    return errorResponse('Failed to create export. Please try again later.', 500);
  }

  if (existingJob) {
    return errorResponse('An export job is already in progress', 400);
  }

  const { data: job, error: createError } = await supabase.rpc('create_gdpr_export_job', {
    p_user_id: auth.user.id,
  });

  if (createError) {
    log.logError('Failed to create export job', createError);
    return errorResponse('Failed to create export. Please try again later.', 500);
  }

  const { data: exportData, error: exportError } = await supabase.rpc('get_user_export_data', {
    p_user_id: auth.user.id,
  });

  if (exportError) {
    log.logError('Failed to generate export data', exportError);
    return errorResponse('Failed to create export. Please try again later.', 500);
  }

  const { error: updateError } = await supabase
    .from('gdpr_export_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  if (updateError) {
    log.logError('Failed to update export job status', updateError);
  }

  return successResponse({
    jobId: job.id,
    exportData,
  });
}, { rateLimit: 'SENSITIVE' });
