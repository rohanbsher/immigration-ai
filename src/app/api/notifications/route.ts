import { NextRequest } from 'next/server';
import { notificationsService } from '@/lib/db';
import { withAuth } from '@/lib/api';

export const GET = withAuth(async (request: NextRequest, _context, auth) => {
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50');

  const notifications = await notificationsService.getNotifications(auth.user.id, {
    unreadOnly,
    limit,
  });

  return { data: notifications };
});
