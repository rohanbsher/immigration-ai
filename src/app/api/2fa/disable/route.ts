import { z } from 'zod';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';
import { disableTwoFactor } from '@/lib/2fa';

const disableSchema = z.object({
  token: z.string().min(6).max(8),
});

export const POST = withAuth(async (request, _context, auth) => {
  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const validation = disableSchema.safeParse(body);

  if (!validation.success) {
    return errorResponse('Invalid request', 400, validation.error.flatten() as Record<string, unknown>);
  }

  const { token } = validation.data;
  const success = await disableTwoFactor(auth.user.id, token);

  if (!success) {
    return errorResponse('Invalid verification code', 400);
  }

  return successResponse({
    disabled: true,
    message: '2FA has been disabled',
  });
}, { rateLimit: 'SENSITIVE' });
