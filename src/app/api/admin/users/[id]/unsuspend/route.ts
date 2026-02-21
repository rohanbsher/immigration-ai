import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { getAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { schemas } from '@/lib/validation';

const log = createLogger('api:admin-users-unsuspend');

export const POST = withAuth(async (_request, context, auth) => {
  const { id } = await context.params!;

  const uuidResult = schemas.uuid.safeParse(id);
  if (!uuidResult.success) {
    return errorResponse('Invalid user ID', 400);
  }

  const adminClient = getAdminClient();

  const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(id);
  if (getUserError || !targetUser?.user) {
    return errorResponse('User not found', 404);
  }

  const { error: unbanError } = await adminClient.auth.admin.updateUserById(id, {
    ban_duration: 'none',
  });

  if (unbanError) {
    log.logError('Failed to unsuspend user', { userId: id, error: unbanError.message });
    return errorResponse('Failed to unsuspend user', 500);
  }

  log.info('User unsuspended', { userId: id, adminId: auth.profile.id });

  return successResponse({ message: 'User unsuspended' });
}, { roles: ['admin'], rateLimit: 'SENSITIVE' });
