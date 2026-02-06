import { NextResponse } from 'next/server';
import { z } from 'zod';
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

const createClientSchema = z.object({
  email: z.string().email('Valid email is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
});

/**
 * POST /api/clients - Create a new client (attorney only)
 */
export const POST = withAttorneyAuth(async (request) => {
  try {
    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const client = await clientsService.createClient(parsed.data);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create client';
    log.logError('Error creating client', error);

    if (message.includes('already exists')) {
      return errorResponse(message, 409);
    }

    return errorResponse(message, 500);
  }
});
