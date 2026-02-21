import { z } from 'zod';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';
import { regenerateBackupCodes } from '@/lib/2fa';

const regenerateSchema = z.object({
  token: z.string().min(6).max(6),
});

export const POST = withAuth(async (request, _context, auth) => {
  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const validation = regenerateSchema.safeParse(body);

  if (!validation.success) {
    return errorResponse('Invalid request', 400, validation.error.flatten() as Record<string, unknown>);
  }

  const { token } = validation.data;
  const backupCodes = await regenerateBackupCodes(auth.user.id, token);

  return successResponse({
    backupCodes,
    message: 'New backup codes generated. Previous codes are now invalid.',
  });
}, { rateLimit: 'AUTH' });
