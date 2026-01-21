import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Allowed paths for redirect after authentication.
 * This prevents open redirect vulnerabilities.
 */
const ALLOWED_REDIRECT_PATHS = [
  '/dashboard',
  '/cases',
  '/documents',
  '/forms',
  '/settings',
  '/profile',
];

/**
 * Validate that the redirect path is safe.
 * Only allows relative paths to known safe destinations.
 */
function validateRedirectPath(path: string): string {
  // Default to dashboard
  const defaultPath = '/dashboard';

  // Must be a string
  if (typeof path !== 'string') {
    return defaultPath;
  }

  // Must start with / (relative path)
  if (!path.startsWith('/')) {
    return defaultPath;
  }

  // Must not contain protocol indicators (prevent //evil.com)
  if (path.startsWith('//') || path.includes('://')) {
    return defaultPath;
  }

  // Must not contain encoded characters that could bypass checks
  if (path.includes('%') || path.includes('\\')) {
    return defaultPath;
  }

  // Extract the base path (before any query string)
  const basePath = path.split('?')[0].split('#')[0];

  // Check if base path starts with an allowed prefix
  const isAllowed = ALLOWED_REDIRECT_PATHS.some(
    allowed => basePath === allowed || basePath.startsWith(`${allowed}/`)
  );

  if (!isAllowed) {
    return defaultPath;
  }

  return path;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/dashboard';

  // Validate and sanitize the redirect path
  const next = validateRedirectPath(rawNext);

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // Validate forwarded host to prevent host header injection
        const validHostPattern = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/;
        if (validHostPattern.test(forwardedHost)) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        }
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
