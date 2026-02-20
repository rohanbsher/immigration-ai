import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { notificationsService } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:notifications-count');

export const GET = withAuth(async (_request, _context, auth) => {
  try {
    const count = await notificationsService.getUnreadCount(auth.user.id);

    return successResponse({ count });
  } catch (error) {
    log.logError('Error fetching notification count', error);
    return errorResponse('Failed to fetch notification count', 500);
  }
});
