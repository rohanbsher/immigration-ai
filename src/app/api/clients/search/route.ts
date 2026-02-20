import { withAttorneyAuth, errorResponse } from '@/lib/auth/api-helpers';
import { clientsService } from '@/lib/db/clients';
import { createLogger } from '@/lib/logger';
import { NextResponse } from 'next/server';

const log = createLogger('api:clients-search');

export const GET = withAttorneyAuth(async (request, _context, auth) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const clients = await clientsService.searchClients(query, auth.user.id);
    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    log.logError('Error searching clients', error);
    return errorResponse('Failed to search clients', 500);
  }
});
