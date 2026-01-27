/**
 * Centralized configuration module.
 *
 * Import configuration from this module instead of accessing process.env directly.
 * This ensures all environment variables are validated and provides type safety.
 *
 * @example
 * ```typescript
 * import { env, serverEnv, features } from '@/lib/config';
 *
 * // Public env (client-safe)
 * const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
 *
 * // Server env (server-only)
 * const apiKey = serverEnv.OPENAI_API_KEY;
 *
 * // Feature flags
 * if (features.billing) {
 *   // Stripe is configured
 * }
 * ```
 */

export { env, serverEnv, features } from './env';
export type { PublicEnv, ServerEnv } from './env';
