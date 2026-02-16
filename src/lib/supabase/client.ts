import { createBrowserClient } from '@supabase/ssr';

/**
 * Custom lock function that bypasses navigator.locks entirely.
 *
 * The default Supabase auth client uses navigator.locks to serialise
 * token-refresh operations. This works well in long-lived SPAs but causes
 * deadlocks on full-page reloads: the previous page's lock holder is
 * destroyed mid-refresh, leaving an orphaned exclusive lock that blocks
 * every subsequent getSession / getUser / signOut call indefinitely.
 *
 * Bypassing the lock is safe because:
 *  1. Token refreshes are infrequent (~1/hour) and idempotent on the server.
 *  2. The worst-case race is two concurrent refresh calls — the server handles
 *     this gracefully by invalidating only the slower one.
 *  3. A permanently-blocked UI is far worse than a rare double-refresh.
 */
async function noopLock<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  return fn();
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: noopLock,
      },
    }
  );
}
