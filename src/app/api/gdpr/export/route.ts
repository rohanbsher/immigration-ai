import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:gdpr-export');

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: jobs, error } = await supabase
      .from('gdpr_export_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      log.logError('Failed to fetch export jobs', error);
      return NextResponse.json(
        { error: 'Failed to fetch export history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: jobs || [],
    });
  } catch (error) {
    log.logError('GDPR export list error', error);
    return NextResponse.json(
      { error: 'Failed to fetch export history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(RATE_LIMITS.SENSITIVE, ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': rateLimitResult.retryAfter?.toString() || '60' } }
      );
    }

    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: existingJob, error: checkError } = await supabase
      .from('gdpr_export_jobs')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      log.logError('Failed to check existing jobs', checkError);
      return NextResponse.json(
        { error: 'Failed to create export. Please try again later.' },
        { status: 500 }
      );
    }

    if (existingJob) {
      return NextResponse.json(
        { error: 'An export job is already in progress' },
        { status: 400 }
      );
    }

    const { data: job, error: createError } = await supabase.rpc('create_gdpr_export_job', {
      p_user_id: user.id,
    });

    if (createError) {
      log.logError('Failed to create export job', createError);
      return NextResponse.json(
        { error: 'Failed to create export. Please try again later.' },
        { status: 500 }
      );
    }

    const { data: exportData, error: exportError } = await supabase.rpc('get_user_export_data', {
      p_user_id: user.id,
    });

    if (exportError) {
      log.logError('Failed to generate export data', exportError);
      return NextResponse.json(
        { error: 'Failed to create export. Please try again later.' },
        { status: 500 }
      );
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

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        exportData,
      },
    });
  } catch (error) {
    log.logError('GDPR export error', error);
    const message = 'Failed to create export. Please try again later.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
