/**
 * API utilities for route handlers.
 *
 * IMPORTANT: For auth wrappers (withAuth, withAttorneyAuth, withAdminAuth),
 * always import from '@/lib/auth/api-helpers' -- the canonical source.
 * This barrel exports only non-auth utilities like apiHandler.
 *
 * @example
 * ```typescript
 * import { apiHandler } from '@/lib/api';
 *
 * // Simple unauthenticated handler with automatic error handling
 * export const GET = apiHandler(async (request) => {
 *   const data = await fetchData();
 *   return { data };
 * });
 * ```
 */

export { apiHandler } from './handler';

export type {
  RouteContext,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  ApiHandler,
  AuthenticatedApiHandler,
} from './handler';
