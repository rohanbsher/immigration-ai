import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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
      throw new Error(`Failed to fetch export jobs: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: jobs || [],
    });
  } catch (error) {
    console.error('GDPR export list error:', error);
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
      throw new Error(`Failed to check existing jobs: ${checkError.message}`);
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
      throw new Error(`Failed to create export job: ${createError.message}`);
    }

    const { data: exportData, error: exportError } = await supabase.rpc('get_user_export_data', {
      p_user_id: user.id,
    });

    if (exportError) {
      throw new Error(`Failed to generate export data: ${exportError.message}`);
    }

    const { error: updateError } = await supabase
      .from('gdpr_export_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (updateError) {
      console.error('Failed to update export job status:', updateError);
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        exportData,
      },
    });
  } catch (error) {
    console.error('GDPR export error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create export';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
