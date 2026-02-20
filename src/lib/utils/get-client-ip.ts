import { NextRequest } from 'next/server';

/** Basic check: value contains only characters valid in IPv4/IPv6 addresses. */
const IP_CHARS = /^[\d.:a-fA-F]+$/;

function isPlausibleIp(value: string): boolean {
  return IP_CHARS.test(value);
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
