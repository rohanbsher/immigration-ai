import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientsService } from '@/lib/db/clients';
import { withAttorneyAuth, errorResponse } from '@/lib/auth/api-helpers';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clients');

/**
 * GET /api/clients - Get all clients with pagination (attorney only)
 */
export const GET = withAttorneyAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const search = searchParams.get('search') || undefined;

    const { data: clients, total } = await clientsService.getClients({ page, limit, search });

    return NextResponse.json({
      data: clients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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
    log.logError('Error creating client', error);

    if (error instanceof Error && error.message.includes('already exists')) {
      return errorResponse('A user with this email already exists', 409);
    }

    return errorResponse('Failed to create client', 500);
  }
});
