import { withAuth, successResponse } from '@/lib/auth/api-helpers';
import { getTwoFactorStatus } from '@/lib/2fa';

export const GET = withAuth(async (_request, _context, auth) => {
  const status = await getTwoFactorStatus(auth.user.id);

  return successResponse(status);
}, { rateLimit: 'SENSITIVE' });
