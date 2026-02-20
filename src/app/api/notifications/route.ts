import { NextResponse } from 'next/server';
import { notificationsService } from '@/lib/db';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:notifications');

export const GET = withAuth(async (request, _context, auth) => {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100);

    const notifications = await notificationsService.getNotifications(auth.user.id, {
      unreadOnly,
      limit,
    });

    return successResponse(notifications);
  } catch (error) {
    log.logError('Failed to fetch notifications', error);
    return errorResponse('Failed to fetch notifications', 500);
  }
});
