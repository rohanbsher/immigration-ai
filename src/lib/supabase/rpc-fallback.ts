/**
 * RPC fallback utility for graceful degradation.
 *
 * Provides a wrapper around Supabase RPC calls that automatically
 * falls back to an alternative implementation when the RPC function
 * doesn't exist (e.g., migration not applied yet).
 *
 * This prevents hard failures when database functions are missing,
 * allowing the application to continue working while logging warnings.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const logger = createLogger('rpc-fallback');

interface RpcWithFallbackOptions<T> {
  /** Supabase client instance */
  supabase: SupabaseClient;
  /** Name of the RPC function to call */
  rpcName: string;
  /** Parameters to pass to the RPC function */
  rpcParams: Record<string, unknown>;
  /** Fallback function to execute if RPC doesn't exist */
  fallback: () => Promise<T>;
  /** Additional context for logging */
  logContext?: Record<string, unknown>;
}

/**
 * PostgreSQL error code for undefined function.
 * This is raised when calling an RPC that doesn't exist.
 */
const UNDEFINED_FUNCTION_ERROR_CODE = '42883';

/**
 * Execute an RPC call with automatic fallback if the function doesn't exist.
 *
 * @example
 * ```typescript
 * const result = await rpcWithFallback({
 *   supabase,
 *   rpcName: 'update_message_with_metadata',
 *   rpcParams: { p_message_id: id, p_content: content },
 *   fallback: async () => {
 *     // Manual update logic here
 *     const { error } = await supabase.from('messages').update({ content }).eq('id', id);
 *     if (error) throw error;
 *   },
 *   logContext: { messageId: id },
 * });
 * ```
 */
export async function rpcWithFallback<T>({
  supabase,
  rpcName,
  rpcParams,
  fallback,
  logContext = {},
}: RpcWithFallbackOptions<T>): Promise<T> {
  const { data, error } = await supabase.rpc(rpcName, rpcParams);

  if (error) {
    const errorMessage = error.message?.toLowerCase() ?? '';
    const isMissingFunction =
      error.code === UNDEFINED_FUNCTION_ERROR_CODE ||
      (errorMessage.includes('function') && errorMessage.includes('does not exist')) ||
      (errorMessage.includes('could not find') && errorMessage.includes('function'));

    if (isMissingFunction) {
      logger.warn(`RPC "${rpcName}" not found, using fallback`, {
        rpcName,
        ...logContext,
      });
      return fallback();
    }

    // Re-throw non-missing-function errors
    throw error;
  }

  return data as T;
}
