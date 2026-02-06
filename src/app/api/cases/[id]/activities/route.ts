import { NextRequest, NextResponse } from 'next/server';
import { activitiesService, casesService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { standardRateLimiter } from '@/lib/rate-limit';

const log = createLogger('api:case-activities');

async function verifyCaseAccess(userId: string, caseId: string): Promise<boolean> {
  const caseData = await casesService.getCase(caseId);
  if (!caseData) return false;

  if (caseData.attorney_id === userId || caseData.client_id === userId) {
    return true;
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return profile?.role === 'admin';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const hasAccess = await verifyCaseAccess(user.id, caseId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const activities = await activitiesService.getActivitiesByCase(caseId, limit);

    return NextResponse.json({ data: activities });
  } catch (error) {
    log.logError('Failed to fetch activities', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
