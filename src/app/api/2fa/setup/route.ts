import { withAuth, successResponse } from '@/lib/auth/api-helpers';
import { setupTwoFactor } from '@/lib/2fa';

export const POST = withAuth(async (_request, _context, auth) => {
  const setup = await setupTwoFactor(auth.user.id, auth.user.email || '');

  return successResponse({
    qrCodeDataUrl: setup.qrCodeDataUrl,
    // Note: Secret is intentionally NOT returned for security reasons.
    // The TOTP secret is embedded in the QR code URI for authenticator apps.
    // Exposing it separately creates unnecessary security risk (logging, interception).
    backupCodes: setup.backupCodes,
  });
}, { rateLimit: 'SENSITIVE' });
