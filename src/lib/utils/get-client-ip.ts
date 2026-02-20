import { NextRequest } from 'next/server';

/**
 * Lightweight plausibility check for IP addresses.
 * IPv4: must have exactly 3 dots separating digit groups (e.g. 192.168.1.1).
 * IPv6: must contain at least one colon and only hex/colon/dot chars
 *       (dots allowed for IPv4-mapped addresses like ::ffff:192.168.1.1).
 * Not a full RFC validator — just enough to reject obvious non-IPs.
 */
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_CHARS = /^[\da-fA-F:.]+$/;

function isPlausibleIp(value: string): boolean {
  if (IPV4_PATTERN.test(value)) return true;
  if (value.includes(':') && /[\da-fA-F]/.test(value) && IPV6_CHARS.test(value)) return true;
  return false;
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
