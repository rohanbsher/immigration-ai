import { createClient } from '@/lib/supabase/server';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:auth-logout');

export const POST = withAuth(async (_request, _context, auth) => {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      log.warn('Logout failed', { userId: auth.user.id });
      return errorResponse('Logout failed', 400);
    }

    return successResponse({ message: 'Logged out successfully' });
  } catch (error) {
    log.logError('Logout error', error);
    return errorResponse('An unexpected error occurred', 500);
  }
}, { rateLimit: false });
