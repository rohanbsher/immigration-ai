import { NextRequest, NextResponse } from 'next/server';
import { clientsService } from '@/lib/db/clients';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { profilesService } from '@/lib/db/profiles';
import { z } from 'zod';
import { standardRateLimiter } from '@/lib/rate-limit';
import { encrypt } from '@/lib/crypto';
import { createLogger } from '@/lib/logger';
import { safeParseBody } from '@/lib/auth/api-helpers';

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
 * - User is an attorney with at least one case with this client, OR
 * - The client belongs to the same firm (caseless client with primary_firm_id)
 */
async function canAccessClient(userId: string, clientId: string): Promise<boolean> {
  // User is the client themselves
  if (userId === clientId) {
    return true;
  }

  // Check if user is an attorney with an active case for this client
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from('cases')
    .select('id')
    .eq('attorney_id', userId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .limit(1);

  if (cases !== null && cases.length > 0) {
    return true;
  }

  // Fallback: check if the client belongs to the same firm (caseless client).
  // Uses admin client to bypass RLS for cross-table firm lookup.
  const admin = getAdminClient();

  const { data: attorneyProfile } = await admin
    .from('profiles')
    .select('primary_firm_id')
    .eq('id', userId)
    .single();

  let firmId = (attorneyProfile as { primary_firm_id: string | null } | null)?.primary_firm_id;

  if (!firmId) {
    const { data: membership } = await admin
      .from('firm_members')
      .select('firm_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    firmId = (membership as { firm_id: string } | null)?.firm_id ?? null;
  }

  if (!firmId) {
    return false;
  }

  const { data: clientProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', clientId)
    .eq('role', 'client')
    .eq('primary_firm_id', firmId)
    .single();

  return clientProfile !== null;
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

    const client = await clientsService.getClientById(id, user.id);

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

    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const validatedData = updateClientSchema.parse(body);

    // Only encrypt alien_number (the only actually sensitive field in this schema).
    // Other fields like date_of_birth and names are not sensitive enough to warrant
    // encryption and would match overly broad patterns in encryptSensitiveFields.
    const { alien_number, ...rest } = validatedData;
    const updateData: Record<string, unknown> = { ...rest };
    if (alien_number !== undefined) {
      updateData.alien_number = alien_number !== null ? encrypt(alien_number) : null;
    }

    const client = await clientsService.updateClient(id, updateData, user.id);
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
