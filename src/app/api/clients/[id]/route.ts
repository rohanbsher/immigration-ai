import { NextRequest } from 'next/server';
import { clientsService } from '@/lib/db/clients';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { profilesService } from '@/lib/db/profiles';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto';
import { withAuth, successResponse, errorResponse, safeParseBody, resolveUserFirmId } from '@/lib/auth/api-helpers';

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
  const firmId = await resolveUserFirmId(userId);

  if (!firmId) {
    return false;
  }

  const admin = getAdminClient();
  const { data: clientProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', clientId)
    .eq('role', 'client')
    .eq('primary_firm_id', firmId)
    .single();

  return clientProfile !== null;
}

export const GET = withAuth(async (request, context, auth) => {
  const { id } = await context.params!;

  // Authorization check
  const hasAccess = await canAccessClient(auth.user.id, id);
  if (!hasAccess) {
    return errorResponse('Forbidden', 403);
  }

  const client = await clientsService.getClientById(id, auth.user.id);

  if (!client) {
    return errorResponse('Client not found', 404);
  }

  return successResponse(client);
}, { rateLimit: 'STANDARD' });

export const PATCH = withAuth(async (request, context, auth) => {
  const { id } = await context.params!;

  // Authorization check - only the client themselves or their attorney can update
  const hasAccess = await canAccessClient(auth.user.id, id);
  if (!hasAccess) {
    return errorResponse('Forbidden', 403);
  }

  // Get user profile to check role for additional restrictions
  const profile = await profilesService.getProfile(auth.user.id);

  // Clients can only update their own profile, attorneys can update their clients
  if (profile?.role === 'client' && auth.user.id !== id) {
    return errorResponse('Forbidden', 403);
  }

  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  try {
    const validatedData = updateClientSchema.parse(body);

    // Only encrypt alien_number (the only actually sensitive field in this schema).
    // Other fields like date_of_birth and names are not sensitive enough to warrant
    // encryption and would match overly broad patterns in encryptSensitiveFields.
    const { alien_number, ...rest } = validatedData;
    const updateData: Record<string, unknown> = { ...rest };
    if (alien_number !== undefined) {
      updateData.alien_number = alien_number !== null ? encrypt(alien_number) : null;
    }

    const client = await clientsService.updateClient(id, updateData, auth.user.id);
    return successResponse(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }

    throw error;
  }
}, { rateLimit: 'STANDARD' });
