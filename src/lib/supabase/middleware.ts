import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { validateCsrf } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';

const log = createLogger('middleware');

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

  // Admin route protection - check user role
  if (isAdminPath && user) {
    if (!profileError && (!profile || profile.role !== 'admin')) {
      log.warn(`Non-admin user attempted to access admin route: ${request.nextUrl.pathname}`, { requestId });
      const url = request.nextUrl.clone();
      url.pathname = profile?.role === 'client' ? '/dashboard/client' : '/dashboard';
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.headers.set('x-request-id', requestId);
      return redirectResponse;
    }
  }

  // Client portal routing
  const isClientPortalPath = request.nextUrl.pathname.startsWith('/dashboard/client');
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

  // Add server timing header for performance monitoring
  const duration = Date.now() - startTime;
  supabaseResponse.headers.set('server-timing', `middleware;dur=${duration}`);

  // Ensure request ID is on the final response (may have been replaced by setAll)
  supabaseResponse.headers.set('x-request-id', requestId);

  return supabaseResponse;
}
