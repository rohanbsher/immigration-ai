import { isIP } from 'net';
import { NextRequest } from 'next/server';

/**
 * Validate an IP address using Node.js built-in `net.isIP()`.
 * Returns true for valid IPv4 and IPv6 addresses (including IPv4-mapped
 * IPv6 like ::ffff:192.168.1.1). Returns false for everything else.
 */
function isPlausibleIp(value: string): boolean {
  return isIP(value) !== 0;
}

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
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp && isPlausibleIp(firstIp)) {
      return firstIp;
    }
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && isPlausibleIp(realIp)) {
    return realIp;
  }

  return 'anonymous';
}
