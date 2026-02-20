import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { notificationsService } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:notifications-mark-all-read');

export const POST = withAuth(async (_request, _context, auth) => {
  try {
    await notificationsService.markAllAsRead(auth.user.id);

    return successResponse({ marked: true });
  } catch (error) {
    log.logError('Error marking all notifications as read', error);
    return errorResponse('Failed to mark all notifications as read', 500);
  }
});
