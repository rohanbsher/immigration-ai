import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { getAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { schemas } from '@/lib/validation';

const log = createLogger('api:admin-users-suspend');

export const POST = withAuth(async (_request, context, auth) => {
  const { id } = await context.params!;

  const uuidResult = schemas.uuid.safeParse(id);
  if (!uuidResult.success) {
    return errorResponse('Invalid user ID', 400);
  }

  if (id === auth.profile.id) {
    return errorResponse('Cannot suspend your own account', 400);
  }

  const adminClient = getAdminClient();

  const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(id);
  if (getUserError || !targetUser?.user) {
    return errorResponse('User not found', 404);
  }

  const { error: banError } = await adminClient.auth.admin.updateUserById(id, {
    ban_duration: '876000h',
  });

  if (banError) {
    log.logError('Failed to suspend user', { userId: id, error: banError.message });
    return errorResponse('Failed to suspend user', 500);
  }

  log.info('User suspended', { userId: id, adminId: auth.profile.id });

  return successResponse({ message: 'User suspended' });
}, { roles: ['admin'], rateLimit: 'SENSITIVE' });
