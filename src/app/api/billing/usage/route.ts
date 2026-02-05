import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { checkQuota } from '@/lib/billing/quota';
import { standardRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import type { UsageData } from '@/types/billing';

const log = createLogger('api:billing-usage');

export async function GET(request: NextRequest) {
  try {
    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const [casesQuota, documentsQuota, aiQuota, teamQuota] = await Promise.all([
      checkQuota(user.id, 'cases'),
      checkQuota(user.id, 'documents'),
      checkQuota(user.id, 'ai_requests'),
      checkQuota(user.id, 'team_members'),
    ]);

    const usage: UsageData = {
      cases: casesQuota.current,
      documents: documentsQuota.current,
      aiRequests: aiQuota.current,
      teamMembers: teamQuota.current,
    };

    return NextResponse.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    log.logError('Usage fetch error', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
