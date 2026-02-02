/**
 * CSRF Protection Utility
 *
 * Uses the "Origin/Referer" validation pattern for API routes.
 * This is simpler and more appropriate for modern SPAs with API routes
 * than traditional token-based CSRF protection.
 *
 * How it works:
 * 1. For state-changing requests (POST, PUT, PATCH, DELETE)
 * 2. Validate that Origin or Referer header matches our domain
 * 3. Reject requests from other origins
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('csrf');

/**
 * Get the allowed origins for CSRF validation.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Add the production URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    origins.push(process.env.NEXT_PUBLIC_SITE_URL);
  }

  // Add Vercel preview URLs
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  // Add localhost for development
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3000');
  }

  return origins;
}

/**
 * Normalize a URL to just the origin (protocol + host).
 */
function normalizeOrigin(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Check if a request has a valid origin for CSRF protection.
 */
export function validateCsrf(request: NextRequest): {
  valid: boolean;
  reason?: string;
} {
  const method = request.method.toUpperCase();

  // Only validate state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { valid: true };
  }

  // Get the Origin or Referer header
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // For same-origin requests, Origin might not be set
  // In that case, check Referer
  const requestOrigin = origin || normalizeOrigin(referer);

  // If neither Origin nor Referer is set, it could be:
  // 1. A same-origin request where the browser didn't send headers (rare in modern browsers)
  // 2. A cross-origin request from an old browser
  // 3. A direct API call (like from curl or a service)
  if (!requestOrigin) {
    // For security, require an explicit API client header for requests without Origin/Referer.
    // Legitimate API clients should set: X-API-Client: true
    // Modern browsers always send Origin/Referer for cross-origin state-changing requests.
    const isApiClient = request.headers.get('x-api-client') === 'true';

    // Allow webhook endpoints that verify their own signatures (e.g., Stripe webhooks)
    const pathname = request.nextUrl?.pathname || '';
    const isWebhookPath = pathname.includes('/webhooks') || pathname.includes('/webhook');

    if (isApiClient || isWebhookPath) {
      return { valid: true, reason: 'api-client-or-webhook' };
    }

    // Reject requests without Origin/Referer and without API client header
    // This prevents CSRF attacks via old browsers or header-stripping proxies
    return {
      valid: false,
      reason: 'Missing Origin/Referer header. For API clients, include X-API-Client: true header.',
    };
  }

  // Get allowed origins
  const allowedOrigins = getAllowedOrigins();

  // Also allow the current host
  const host = request.headers.get('host');
  if (host) {
    // Determine protocol based on x-forwarded-proto or assume https in production
    const proto =
      request.headers.get('x-forwarded-proto') ||
      (process.env.NODE_ENV === 'development' ? 'http' : 'https');
    allowedOrigins.push(`${proto}://${host}`);
  }

  // Check if the request origin matches any allowed origin
  const isAllowed = allowedOrigins.some(
    (allowed) => normalizeOrigin(allowed) === requestOrigin
  );

  if (!isAllowed) {
    return {
      valid: false,
      reason: `Origin ${requestOrigin} not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Middleware function to validate CSRF for API routes.
 * Use this in API route handlers for additional protection.
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
  const validation = validateCsrf(request);

  if (!validation.valid) {
    log.warn(`CSRF validation failed: ${validation.reason}`);
    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    );
  }

  return null; // Validation passed
}

/**
 * Higher-order function to wrap an API handler with CSRF protection.
 */
export function withCsrfProtection<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
): (request: NextRequest, ...args: T) => Promise<NextResponse> {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const csrfError = csrfMiddleware(request);
    if (csrfError) {
      return csrfError;
    }

    return handler(request, ...args);
  };
}

/**
 * Generate a CSRF token for forms (if needed for traditional form submission).
 * This is optional - the Origin/Referer validation is usually sufficient.
 */
export function generateCsrfToken(): string {
  // Use crypto.randomUUID if available, otherwise fall back to a simple implementation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Simple fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * CSRF configuration for setting the cookie.
 */
export const CSRF_COOKIE_CONFIG = {
  name: 'csrf_token',
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  },
};
