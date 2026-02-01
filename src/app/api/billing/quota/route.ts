import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth';
import { checkQuota, QuotaMetric } from '@/lib/billing/quota';
import { z } from 'zod';
import { standardRateLimiter } from '@/lib/rate-limit';

const querySchema = z.object({
  metric: z.enum(['cases', 'documents', 'ai_requests', 'storage', 'team_members']),
});

export async function GET(request: NextRequest) {
  try {
    const user = await serverAuth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric');

    const validation = querySchema.safeParse({ metric });
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid metric parameter' },
        { status: 400 }
      );
    }

    const quota = await checkQuota(user.id, validation.data.metric as QuotaMetric);

    return NextResponse.json({
      success: true,
      data: quota,
    });
  } catch (error) {
    console.error('Quota check error:', error);
    return NextResponse.json(
      { error: 'Failed to check quota' },
      { status: 500 }
    );
  }
}
