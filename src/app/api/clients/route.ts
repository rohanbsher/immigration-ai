import { NextResponse } from 'next/server';
import { clientsService } from '@/lib/db/clients';
import { withAttorneyAuth, errorResponse } from '@/lib/auth/api-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clients');

/**
 * GET /api/clients - Get all clients (attorney only)
 */
export const GET = withAttorneyAuth(async () => {
  try {
    const clients = await clientsService.getClients();
    return NextResponse.json(clients);
  } catch (error) {
    log.logError('Error fetching clients', error);
    return errorResponse('Failed to fetch clients', 500);
  }
});
