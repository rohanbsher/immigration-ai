/**
 * API utilities for route handlers.
 *
 * @example
 * ```typescript
 * import { apiHandler, withAuth, withAttorneyAuth } from '@/lib/api';
 *
 * // Simple handler with automatic error handling
 * export const GET = apiHandler(async (request) => {
 *   const data = await fetchData();
 *   return { data };
 * });
 *
 * // With authentication
 * export const POST = withAuth(async (request, context, auth) => {
 *   return { data: { userId: auth.user.id } };
 * });
 *
 * // With attorney role requirement
 * export const DELETE = withAttorneyAuth(async (request, context, auth) => {
 *   return { data: { deleted: true } };
 * });
 * ```
 */

export {
  apiHandler,
  withAuth,
  withAttorneyAuth,
  withAdminAuth,
  withAttorneyOrAdminAuth,
} from './handler';

export type {
  RouteContext,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  ApiHandler,
  AuthenticatedApiHandler,
} from './handler';
