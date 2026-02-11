/**
 * Supabase Admin Client
 *
 * Uses the service role key to bypass Row Level Security (RLS).
 * Only use this for trusted server-side operations after user authentication.
 *
 * WARNING: Never expose this client or its operations to client-side code.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let adminClient: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Get the Supabase admin client (singleton).
 * Uses service role key to bypass RLS.
 */
export function getAdminClient() {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase admin credentials');
    }

    adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

/**
 * Profile type for database queries
 */
export interface ProfileRow {
  id: string;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  mfa_enabled: boolean;
  ai_consent_granted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch a user's profile using admin privileges.
 * Use this after validating the user with getUser().
 */
export async function getProfileAsAdmin(userId: string): Promise<{
  profile: ProfileRow | null;
  error: Error | null;
}> {
  const admin = getAdminClient();

  const { data: profile, error } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return { profile: profile as ProfileRow | null, error };
}
