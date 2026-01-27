import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

/**
 * Generate a unique request ID for tracing.
 */
function generateRequestId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}`;
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
      console.warn(`[${requestId}] CSRF validation failed: ${csrfValidation.reason}`);
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
  const protectedPaths = ['/dashboard', '/cases', '/documents', '/forms', '/settings'];
  const authPaths = ['/login', '/register', '/forgot-password'];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
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

  // Add server timing header for performance monitoring
  const duration = Date.now() - startTime;
  supabaseResponse.headers.set('server-timing', `middleware;dur=${duration}`);

  // Ensure request ID is on the final response (may have been replaced by setAll)
  supabaseResponse.headers.set('x-request-id', requestId);

  return supabaseResponse;
}
