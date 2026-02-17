import { NextRequest } from 'next/server';

/**
 * Extract the client IP address from a Next.js request.
 *
 * Checks standard proxy headers in order:
 *   1. x-forwarded-for (first entry, set by reverse proxies / load balancers)
 *   2. x-real-ip (set by Nginx and some CDNs)
 *   3. Falls back to 'anonymous' when no header is present
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'anonymous';
}
