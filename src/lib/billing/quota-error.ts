import { NextResponse } from 'next/server';
import { QuotaExceededError } from './quota';

/**
 * Human-readable messages for each quota resource type.
 */
const QUOTA_MESSAGES: Record<string, string> = {
  cases: 'You have reached your case limit. Please upgrade your plan to create more cases.',
  documents: 'You have reached the document limit for this case. Please upgrade your plan.',
  storage: 'You have reached your storage limit. Please upgrade your plan.',
  ai_requests: 'AI request limit reached. Please upgrade your plan.',
  team_members: 'You have reached your team member limit. Please upgrade your plan.',
};

const DEFAULT_MESSAGE = 'Quota exceeded. Please upgrade your plan.';

/**
 * Create a standardized 402 response for quota exceeded errors.
 *
 * @param resource - The quota resource that was exceeded (e.g. 'cases', 'ai_requests').
 *                   If omitted, a generic message is used.
 */
export function quotaExceededResponse(resource?: string): NextResponse {
  const message = (resource && QUOTA_MESSAGES[resource]) || DEFAULT_MESSAGE;
  return NextResponse.json(
    { error: message, code: 'QUOTA_EXCEEDED' },
    { status: 402 }
  );
}

/**
 * Check if an error is a QuotaExceededError and return the appropriate response.
 * Returns null if the error is not a quota error (caller should re-throw).
 *
 * @example
 * ```typescript
 * try {
 *   await enforceQuota(userId, 'ai_requests');
 * } catch (error) {
 *   const qr = handleQuotaError(error, 'ai_requests');
 *   if (qr) return qr;
 *   throw error;
 * }
 * ```
 */
export function handleQuotaError(error: unknown, resource?: string): NextResponse | null {
  if (error instanceof QuotaExceededError) {
    return quotaExceededResponse(resource ?? error.metric);
  }
  return null;
}
