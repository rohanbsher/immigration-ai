import { NextRequest, NextResponse } from 'next/server';
import { clientsService } from '@/lib/db/clients';
import { createClient } from '@/lib/supabase/server';
import { profilesService } from '@/lib/db/profiles';
import { z } from 'zod';
import { standardRateLimiter } from '@/lib/rate-limit';
import { encryptSensitiveFields } from '@/lib/crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clients-detail');

const updateClientSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  country_of_birth: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  alien_number: z.string().nullable().optional(),
});

/**
 * Verify that the current user can access this client.
 * Returns true if:
 * - User is the client themselves, OR
 * - User is an attorney with at least one case with this client
 */
async function canAccessClient(userId: string, clientId: string): Promise<boolean> {
  // User is the client themselves
  if (userId === clientId) {
    return true;
  }

  // Check if user is an attorney with a case for this client
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from('cases')
    .select('id')
    .eq('attorney_id', userId)
    .eq('client_id', clientId)
    .limit(1);

  return cases !== null && cases.length > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Authorization check
    const hasAccess = await canAccessClient(user.id, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await clientsService.getClientById(id);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    log.logError('Error fetching client', error);
    return NextResponse.json(
      { error: 'Failed to fetch client' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Authorization check - only the client themselves or their attorney can update
    const hasAccess = await canAccessClient(user.id, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user profile to check role for additional restrictions
    const profile = await profilesService.getProfile(user.id);

    // Clients can only update their own profile, attorneys can update their clients
    if (profile?.role === 'client' && user.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateClientSchema.parse(body);
    const encryptedData = encryptSensitiveFields(validatedData);

    const client = await clientsService.updateClient(id, encryptedData);
    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    log.logError('Error updating client', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}
