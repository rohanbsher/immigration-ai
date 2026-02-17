/**
 * Authentication and authorization helpers for API routes.
 *
 * Provides a unified interface for auth checks, role validation,
 * and resource access control, reducing boilerplate across API routes.
 *
 * @example
 * ```typescript
 * import { requireAuth, requireAttorney, errorResponse } from '@/lib/auth/api-helpers';
 *
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuth(request);
 *   if (!auth.success) return auth.response;
 *
 *   // auth.user and auth.profile are available
 *   return NextResponse.json({ userId: auth.user.id });
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProfileAsAdmin } from '@/lib/supabase/admin';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import type { UserRole } from '@/types';
import { User } from '@supabase/supabase-js';

const log = createLogger('auth:api-helpers');

// =============================================================================
// Types
// =============================================================================

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthSuccess {
  success: true;
  user: User;
  profile: Profile;
}

export interface AuthError {
  success: false;
  response: NextResponse;
  error: string;
}

export type AuthResult = AuthSuccess | AuthError;

export interface AuthOptions {
  /** Required roles (user must have one of these) */
  roles?: UserRole[];
  /** Apply rate limiting */
  rateLimit?: keyof typeof RATE_LIMITS | false;
  /** Custom rate limit key (defaults to user ID or IP) */
  rateLimitKey?: string;
}

export interface ResourceAccess {
  canView: boolean;
  canModify: boolean;
  canDelete: boolean;
  isOwner: boolean;
  isAttorney: boolean;
  isClient: boolean;
}

export interface CaseAccessResult {
  success: true;
  caseData: {
    id: string;
    attorney_id: string;
    client_id: string;
  };
  access: ResourceAccess;
}

export interface DocumentAccessResult {
  success: true;
  document: {
    id: string;
    case_id: string;
    uploaded_by: string;
  };
  caseData: {
    id: string;
    attorney_id: string;
    client_id: string;
  };
  access: ResourceAccess;
}

export interface FormAccessResult {
  success: true;
  form: {
    id: string;
    case_id: string;
  };
  caseData: {
    id: string;
    attorney_id: string;
    client_id: string;
  };
  access: ResourceAccess;
}

export type AccessResult<T> =
  | T
  | { success: false; error: string; status: number };

// =============================================================================
// Helper Utilities
// =============================================================================

/**
 * Get client IP address from request headers.
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Create a standardized error response.
 */
export function errorResponse(
  error: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * Create a standardized success response.
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

// Re-export from lightweight module so routes that already import from api-helpers
// don't need an extra import line.
export { safeParseBody } from '@/lib/api/safe-parse-body';

// =============================================================================
// Core Authentication
// =============================================================================

/**
 * Core authentication function with optional role and rate limit checks.
 *
 * @example
 * ```typescript
 * const auth = await authenticate(request, { roles: ['attorney', 'admin'] });
 * if (!auth.success) return auth.response;
 * ```
 */
export async function authenticate(
  request: NextRequest,
  options: AuthOptions = {}
): Promise<AuthResult> {
  const { roles, rateLimit: rateLimitConfig = 'STANDARD', rateLimitKey } = options;

  // Apply rate limiting if configured
  if (rateLimitConfig !== false) {
    const limitConfig = RATE_LIMITS[rateLimitConfig];
    const ip = rateLimitKey || getClientIp(request);
    const result = await rateLimit(limitConfig, ip);

    if (!result.success) {
      return {
        success: false,
        error: 'Too many requests',
        response: NextResponse.json(
          { error: 'Too many requests' },
          {
            status: 429,
            headers: {
              'Retry-After': result.retryAfter?.toString() || '60',
            },
          }
        ),
      };
    }
  }

  // Get authenticated user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Debug logging for 401 errors
    log.debug('401 Unauthorized', {
      hasCookieHeader: !!request.headers.get('cookie'),
      url: request.url,
      method: request.method,
    });
    return {
      success: false,
      error: 'Unauthorized',
      response: errorResponse('Unauthorized', 401),
    };
  }

  // Get user profile using admin client (bypasses RLS since user is already authenticated)
  const { profile, error: profileError } = await getProfileAsAdmin(user.id);

  if (profileError || !profile) {
    log.error('Profile lookup failed for user', { userId: user.id, error: profileError?.message || 'No profile row' });
    return {
      success: false,
      error: 'Profile not found',
      response: errorResponse(
        'Profile not found',
        401
      ),
    };
  }

  // Check role if specified
  if (roles && roles.length > 0) {
    if (!roles.includes(profile.role as UserRole)) {
      return {
        success: false,
        error: 'Forbidden',
        response: errorResponse(
          `Access denied. Required role: ${roles.join(' or ')}`,
          403
        ),
      };
    }
  }

  return {
    success: true,
    user,
    profile: profile as Profile,
  };
}

/**
 * Require basic authentication (any authenticated user).
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  return authenticate(request);
}

/**
 * Require attorney role.
 */
export async function requireAttorney(request: NextRequest): Promise<AuthResult> {
  return authenticate(request, { roles: ['attorney'] });
}

/**
 * Require admin role.
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  return authenticate(request, { roles: ['admin'] });
}

/**
 * Require attorney or admin role.
 */
export async function requireAttorneyOrAdmin(
  request: NextRequest
): Promise<AuthResult> {
  return authenticate(request, { roles: ['attorney', 'admin'] });
}

// =============================================================================
// AI Consent Enforcement
// =============================================================================

/**
 * Check that the authenticated user has granted AI consent.
 * Call this after authentication in any route that sends PII to AI providers.
 *
 * @returns null if consent is granted, or a 403 NextResponse if not.
 */
export async function requireAiConsent(userId: string): Promise<NextResponse | null> {
  const { profile, error } = await getProfileAsAdmin(userId);

  if (error || !profile) {
    return errorResponse('Profile not found', 401);
  }

  if (!profile.ai_consent_granted_at) {
    return errorResponse('AI consent required', 403);
  }

  return null;
}

// =============================================================================
// Resource Access Verification
// =============================================================================

/**
 * Verify user has access to a case.
 * Returns access flags indicating what operations are permitted.
 */
export async function verifyCaseAccess(
  userId: string,
  caseId: string
): Promise<AccessResult<CaseAccessResult>> {
  const supabase = await createClient();

  const { data: caseData, error } = await supabase
    .from('cases')
    .select('id, attorney_id, client_id')
    .eq('id', caseId)
    .is('deleted_at', null)
    .single();

  if (error || !caseData) {
    return { success: false, error: 'Case not found', status: 404 };
  }

  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;

  if (!isAttorney && !isClient) {
    return { success: false, error: 'Access denied', status: 403 };
  }

  return {
    success: true,
    caseData,
    access: {
      canView: true,
      canModify: isAttorney,
      canDelete: isAttorney,
      isOwner: isAttorney,
      isAttorney,
      isClient,
    },
  };
}

/**
 * Verify user has access to a document via its parent case.
 */
export async function verifyDocumentAccess(
  userId: string,
  documentId: string
): Promise<AccessResult<DocumentAccessResult>> {
  const supabase = await createClient();

  // Get document with its case
  const { data: document, error } = await supabase
    .from('documents')
    .select('id, case_id, uploaded_by')
    .eq('id', documentId)
    .is('deleted_at', null)
    .single();

  if (error || !document) {
    return { success: false, error: 'Document not found', status: 404 };
  }

  // Get case to verify access
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('id, attorney_id, client_id')
    .eq('id', document.case_id)
    .is('deleted_at', null)
    .single();

  if (caseError || !caseData) {
    return { success: false, error: 'Case not found', status: 404 };
  }

  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;
  const isUploader = document.uploaded_by === userId;

  if (!isAttorney && !isClient) {
    return { success: false, error: 'Access denied', status: 403 };
  }

  return {
    success: true,
    document,
    caseData,
    access: {
      canView: true,
      canModify: isAttorney,
      canDelete: isAttorney || isUploader,
      isOwner: isUploader,
      isAttorney,
      isClient,
    },
  };
}

/**
 * Verify user has access to a form via its parent case.
 */
export async function verifyFormAccess(
  userId: string,
  formId: string
): Promise<AccessResult<FormAccessResult>> {
  const supabase = await createClient();

  // Get form
  const { data: form, error } = await supabase
    .from('forms')
    .select('id, case_id')
    .eq('id', formId)
    .is('deleted_at', null)
    .single();

  if (error || !form) {
    return { success: false, error: 'Form not found', status: 404 };
  }

  // Get case to verify access
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('id, attorney_id, client_id')
    .eq('id', form.case_id)
    .is('deleted_at', null)
    .single();

  if (caseError || !caseData) {
    return { success: false, error: 'Case not found', status: 404 };
  }

  const isAttorney = caseData.attorney_id === userId;
  const isClient = caseData.client_id === userId;

  if (!isAttorney && !isClient) {
    return { success: false, error: 'Access denied', status: 403 };
  }

  return {
    success: true,
    form,
    caseData,
    access: {
      canView: true,
      canModify: isAttorney,
      canDelete: isAttorney,
      isOwner: isAttorney,
      isAttorney,
      isClient,
    },
  };
}

// =============================================================================
// Higher-Order Function Wrapper
// =============================================================================

type RouteHandler = (
  request: NextRequest,
  context: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse>;

type AuthenticatedRouteHandler = (
  request: NextRequest,
  context: { params?: Promise<Record<string, string>> },
  auth: AuthSuccess
) => Promise<NextResponse>;

/**
 * Higher-order function to wrap route handlers with authentication.
 *
 * @example
 * ```typescript
 * export const GET = withAuth(
 *   async (request, context, auth) => {
 *     // auth.user and auth.profile are available
 *     return NextResponse.json({ userId: auth.user.id });
 *   },
 *   { roles: ['attorney'] }
 * );
 * ```
 */
export function withAuth(
  handler: AuthenticatedRouteHandler,
  options: AuthOptions = {}
): RouteHandler {
  return async (request, context) => {
    try {
      const auth = await authenticate(request, options);

      if (!auth.success) {
        return auth.response;
      }

      return await handler(request, context, auth);
    } catch (error) {
      log.logError('API error', error);
      return errorResponse('Internal server error', 500);
    }
  };
}

/**
 * Wrap handler with attorney role requirement.
 */
export function withAttorneyAuth(handler: AuthenticatedRouteHandler): RouteHandler {
  return withAuth(handler, { roles: ['attorney'] });
}

/**
 * Wrap handler with admin role requirement.
 */
export function withAdminAuth(handler: AuthenticatedRouteHandler): RouteHandler {
  return withAuth(handler, { roles: ['admin'] });
}
