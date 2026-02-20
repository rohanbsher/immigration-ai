import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createHmac } from 'crypto';
import { validateCsrf } from '@/lib/security';
import { createLogger } from '@/lib/logger';

const log = createLogger('middleware');

/** Idle timeout: 30 minutes of inactivity triggers logout for security. */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_COOKIE_NAME = 'last_activity';

/**
 * HMAC-sign a timestamp to prevent client-side cookie tampering.
 * Uses ENCRYPTION_KEY as the HMAC secret.
 */
function signTimestamp(timestamp: string): string {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    // In development without ENCRYPTION_KEY, fall back to unsigned
    return timestamp;
  }
  const signature = createHmac('sha256', secret).update(timestamp).digest('hex');
  return `${timestamp}.${signature}`;
}

/**
 * Verify and extract the timestamp from an HMAC-signed cookie value.
 * Returns the timestamp if valid, or null if tampered/invalid.
 */
function verifyTimestamp(cookieValue: string): string | null {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    // In development without ENCRYPTION_KEY, accept unsigned values
    return cookieValue;
  }

  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex === -1) {
    // No signature -- likely a pre-upgrade cookie or tampered value
    return null;
  }

  const timestamp = cookieValue.substring(0, dotIndex);
  const providedSignature = cookieValue.substring(dotIndex + 1);

  const expectedSignature = createHmac('sha256', secret).update(timestamp).digest('hex');

  // Timing-safe comparison to prevent timing attacks
  if (providedSignature.length !== expectedSignature.length) {
    return null;
  }

  let mismatch = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    mismatch |= providedSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return null;
  }

  return timestamp;
}

/** Max request body size: 5 MB for API routes (document uploads use storage directly). */
const MAX_BODY_SIZE = 5 * 1024 * 1024;
/** Webhook routes may have larger payloads from Stripe. */
const MAX_WEBHOOK_BODY_SIZE = 10 * 1024 * 1024;

/**
 * Generate a unique request ID for tracing.
 */
function generateRequestId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Cryptographically secure fallback for environments without crypto.randomUUID
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function updateSession(request: NextRequest) {
  // Generate unique request ID for tracing
  const requestId = request.headers.get('x-request-id') || generateRequestId();
  const startTime = Date.now();

  let supabaseResponse = NextResponse.next({
    request,
  });

  // Add request ID to response headers
  supabaseResponse.headers.set('x-request-id', requestId);

  // CSRF protection for API routes with state-changing methods
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const csrfValidation = validateCsrf(request);
    if (!csrfValidation.valid) {
      log.warn(`CSRF validation failed: ${csrfValidation.reason}`, { requestId });
      const csrfResponse = NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      );
      csrfResponse.headers.set('x-request-id', requestId);
      return csrfResponse;
    }

    // Advisory request body size check (NOT a security boundary).
    // Only checks the Content-Length header, which is a client declaration
    // and trivially spoofable. Chunked transfers bypass it entirely.
    // Real enforcement happens at the edge layer (Vercel/Cloudflare).
    // This exists only to reject obviously oversized requests early.
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const bodySize = parseInt(contentLength, 10);
      const isWebhook = request.nextUrl.pathname.startsWith('/api/billing/webhooks');
      const limit = isWebhook ? MAX_WEBHOOK_BODY_SIZE : MAX_BODY_SIZE;
      if (!isNaN(bodySize) && bodySize > limit) {
        log.warn('Request body too large', { requestId, bodySize, limit });
        const sizeResponse = NextResponse.json(
          { error: 'Request body too large' },
          { status: 413 }
        );
        sizeResponse.headers.set('x-request-id', requestId);
        return sizeResponse;
      }
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Idle timeout: check if the user has been inactive too long.
  // For authenticated users on protected routes, enforce a 30-minute idle timeout.
  if (user) {
    const rawCookieValue = request.cookies.get(IDLE_COOKIE_NAME)?.value;
    const now = Date.now();

    if (rawCookieValue) {
      // Verify HMAC signature before trusting the timestamp.
      // If verification fails, treat as expired (force re-auth).
      const verifiedTimestamp = verifyTimestamp(rawCookieValue);

      if (!verifiedTimestamp) {
        log.warn('Idle timeout cookie signature verification failed', { requestId, userId: user.id });
      }

      const lastActivityTime = verifiedTimestamp ? parseInt(verifiedTimestamp, 10) : NaN;
      if (!verifiedTimestamp || (!isNaN(lastActivityTime) && (now - lastActivityTime) > IDLE_TIMEOUT_MS)) {
        // Session has been idle too long or cookie was tampered — sign out and redirect
        log.info('Session idle timeout exceeded', { requestId, userId: user.id, tampered: !verifiedTimestamp });
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          // signOut may fail (network issues, Supabase downtime).
          // Still redirect to login — clearing auth cookies below
          // ensures the client-side session is invalidated regardless.
          log.warn('signOut failed during idle timeout', {
            requestId,
            error: signOutError instanceof Error ? signOutError.message : String(signOutError),
          });
        }
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('reason', 'idle_timeout');
        const redirectResponse = NextResponse.redirect(url);
        redirectResponse.headers.set('x-request-id', requestId);
        // Clear the idle cookie and auth cookies so the session is
        // fully invalidated even if server-side signOut failed.
        redirectResponse.cookies.delete(IDLE_COOKIE_NAME);
        // Clear Supabase auth cookies (standard names used by @supabase/ssr)
        for (const cookie of request.cookies.getAll()) {
          if (cookie.name.startsWith('sb-') || cookie.name.includes('supabase')) {
            redirectResponse.cookies.delete(cookie.name);
          }
        }
        return redirectResponse;
      }
    }

    // Update last activity timestamp with HMAC signature
    const signedValue = signTimestamp(now.toString());
    supabaseResponse.cookies.set(IDLE_COOKIE_NAME, signedValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: IDLE_TIMEOUT_MS / 1000,
    });
  }

  // Define protected routes
  const protectedPaths = ['/dashboard', '/cases', '/documents', '/forms', '/settings', '/admin'];
  const authPaths = ['/login', '/register', '/forgot-password'];
  const adminPaths = ['/admin'];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  const isAdminPath = adminPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnUrl', request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('x-request-id', requestId);
    return redirectResponse;
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('x-request-id', requestId);
    return redirectResponse;
  }

  // Fetch user profile for role-based routing
  const { data: profile, error: profileError } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null, error: null };

  if (profileError) {
    log.warn('Profile query failed in middleware, deferring to layout auth check', {
      requestId,
      error: profileError.message,
    });
  }

  if (user && !profile && !profileError) {
    log.warn('Authenticated user has no profile row, deferring to layout', {
      requestId,
      userId: user.id,
    });
  }

  // Admin route protection - check user role
  if (isAdminPath && user) {
    if (profileError || !profile || profile.role !== 'admin') {
      log.warn(`Non-admin user attempted to access admin route: ${request.nextUrl.pathname}`, { requestId });
      const url = request.nextUrl.clone();
      url.pathname = profile?.role === 'client' ? '/dashboard/client' : '/dashboard';
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.headers.set('x-request-id', requestId);
      return redirectResponse;
    }
  }

  // Client portal routing — match /dashboard/client exactly or /dashboard/client/ subpaths
  // but NOT /dashboard/clients (attorney's client list page)
  const isClientPortalPath =
    request.nextUrl.pathname === '/dashboard/client' ||
    request.nextUrl.pathname.startsWith('/dashboard/client/');
  const isMainDashboardPath = request.nextUrl.pathname === '/dashboard';

  if (user && profile) {
    // Redirect clients from main dashboard to client portal
    if (profile.role === 'client' && isMainDashboardPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard/client';
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.headers.set('x-request-id', requestId);
      return redirectResponse;
    }

    // Prevent non-clients from accessing client portal
    if (profile.role !== 'client' && isClientPortalPath) {
      log.warn(`Non-client user attempted to access client portal: ${request.nextUrl.pathname}`, { requestId });
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.headers.set('x-request-id', requestId);
      return redirectResponse;
    }
  }

  // Add server timing header for performance monitoring (non-production only)
  if (process.env.NODE_ENV !== 'production') {
    const duration = Date.now() - startTime;
    supabaseResponse.headers.set('server-timing', `middleware;dur=${duration}`);
  }

  // Ensure request ID is on the final response (may have been replaced by setAll)
  supabaseResponse.headers.set('x-request-id', requestId);

  return supabaseResponse;
}
