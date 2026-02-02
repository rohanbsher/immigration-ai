import { NextRequest, NextResponse } from 'next/server';
import { notificationsService } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { standardRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:notifications-count');

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const count = await notificationsService.getUnreadCount(user.id);

    return NextResponse.json({ count });
  } catch (error) {
    log.logError('Error fetching notification count', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification count' },
      { status: 500 }
    );
  }
}
