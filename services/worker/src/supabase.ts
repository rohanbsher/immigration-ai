/**
 * Worker Supabase Admin Client
 *
 * Uses the service role key to bypass RLS. Configured from worker-specific
 * env vars (not from @/lib/config which requires NEXT_PUBLIC_* vars).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { workerConfig } from './config';

let adminClient: SupabaseClient | null = null;

/**
 * Get the worker's Supabase admin client (singleton).
 * Uses service role key — bypasses all RLS policies.
 */
export function getWorkerSupabase(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      workerConfig.NEXT_PUBLIC_SUPABASE_URL,
      workerConfig.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return adminClient;
}
