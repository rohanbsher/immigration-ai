import { createLogger } from '@/lib/logger';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { getUserInvoices } from '@/lib/db/subscriptions';

const log = createLogger('api:billing-invoices');

/**
 * GET /api/billing/invoices - Get invoice history for the authenticated user
 */
export const GET = withAuth(async (_request, _context, auth) => {
  try {
    const invoices = await getUserInvoices(auth.user.id);
    return successResponse(invoices);
  } catch (error) {
    log.logError('Failed to get invoices', error);
    return errorResponse('Failed to fetch invoices', 500);
  }
});
