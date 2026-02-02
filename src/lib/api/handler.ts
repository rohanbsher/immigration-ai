/**
 * API Route Handler Utilities
 *
 * Provides a consistent way to handle API routes with built-in:
 * - Error handling and logging
 * - Request/response typing
 * - Authentication
 * - Validation
 *
 * @example
 * ```typescript
 * import { apiHandler, withAuth } from '@/lib/api/handler';
 *
 * // Simple handler
 * export const GET = apiHandler(async (request) => {
 *   const data = await fetchData();
 *   return { data };
 * });
 *
 * // With authentication
 * export const POST = withAuth(async (request, context, auth) => {
 *   // auth.user and auth.profile available
 *   return { userId: auth.user.id };
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import {
  authenticate,
  AuthOptions,
  AuthSuccess,
  errorResponse,
} from '@/lib/auth/api-helpers';
import { formatZodError } from '@/lib/validation';

const log = createLogger('api:handler');

// Route context type
export interface RouteContext {
  params?: Promise<Record<string, string>>;
}

// Handler response types
export interface ApiSuccessResponse<T = unknown> {
  data: T;
  status?: number;
}

export interface ApiErrorResponse {
  error: string;
  status: number;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Check if response is an error
function isErrorResponse(response: ApiResponse): response is ApiErrorResponse {
  return 'error' in response;
}

// Handler function types
export type ApiHandler<T = unknown> = (
  request: NextRequest,
  context: RouteContext
) => Promise<ApiResponse<T>>;

export type AuthenticatedApiHandler<T = unknown> = (
  request: NextRequest,
  context: RouteContext,
  auth: AuthSuccess
) => Promise<ApiResponse<T>>;

/**
 * Wrap an API handler with consistent error handling and response formatting.
 */
export function apiHandler<T>(handler: ApiHandler<T>) {
  return async (
    request: NextRequest,
    context: RouteContext
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = request.headers.get('x-request-id') || 'unknown';

    try {
      const result = await handler(request, context);

      if (isErrorResponse(result)) {
        return errorResponse(result.error, result.status, result.details as Record<string, unknown>);
      }

      const response = NextResponse.json(
        { success: true, data: result.data },
        { status: result.status || 200 }
      );

      // Add timing header
      response.headers.set(
        'server-timing',
        `handler;dur=${Date.now() - startTime}`
      );

      return response;
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const formatted = formatZodError(error);
        log.warn('Validation error', {
          requestId,
          path: request.nextUrl.pathname,
          errors: formatted.fieldErrors,
        });
        return errorResponse(formatted.message, 400, {
          fields: formatted.fieldErrors,
        });
      }

      // Log and return generic error
      log.logError('API handler error', error, {
        requestId,
        path: request.nextUrl.pathname,
        method: request.method,
      });

      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';

      return errorResponse(message, 500);
    }
  };
}

/**
 * Wrap an API handler with authentication.
 * Rate limiting is already applied by the authenticate() function.
 */
export function withAuth<T>(
  handler: AuthenticatedApiHandler<T>,
  options?: AuthOptions
) {
  return apiHandler<T>(async (request, context) => {
    // authenticate() already includes rate limiting via RATE_LIMITS
    const auth = await authenticate(request, options);

    if (!auth.success) {
      return {
        error: auth.error,
        status: auth.response.status,
      };
    }

    return handler(request, context, auth);
  });
}

/**
 * Create a handler that requires attorney role.
 */
export function withAttorneyAuth<T>(handler: AuthenticatedApiHandler<T>) {
  return withAuth(handler, { roles: ['attorney'] });
}

/**
 * Create a handler that requires admin role.
 */
export function withAdminAuth<T>(handler: AuthenticatedApiHandler<T>) {
  return withAuth(handler, { roles: ['admin'] });
}

/**
 * Create a handler that requires attorney or admin role.
 */
export function withAttorneyOrAdminAuth<T>(handler: AuthenticatedApiHandler<T>) {
  return withAuth(handler, { roles: ['attorney', 'admin'] });
}

const apiHandlers = {
  apiHandler,
  withAuth,
  withAttorneyAuth,
  withAdminAuth,
  withAttorneyOrAdminAuth,
};

export default apiHandlers;
