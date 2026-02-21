import { z } from 'zod';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';
import { verifyAndEnableTwoFactor, verifyTwoFactorToken } from '@/lib/2fa';

const verifySchema = z.object({
  token: z.string().min(6).max(8),
  isSetup: z.boolean().optional().default(false),
});

export const POST = withAuth(async (request, _context, auth) => {
  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const validation = verifySchema.safeParse(body);

  if (!validation.success) {
    return errorResponse('Invalid request', 400, validation.error.flatten() as Record<string, unknown>);
  }

  const { token, isSetup } = validation.data;
  let isValid: boolean;

  if (isSetup) {
    isValid = await verifyAndEnableTwoFactor(auth.user.id, token);
  } else {
    isValid = await verifyTwoFactorToken(auth.user.id, token);
  }

  if (!isValid) {
    return errorResponse('Invalid verification code', 400);
  }

  return successResponse({
    verified: true,
    message: isSetup ? '2FA has been enabled' : 'Verification successful',
  });
}, { rateLimit: 'AUTH' });
