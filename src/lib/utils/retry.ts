/**
 * Retry utility with exponential backoff.
 */

export interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelayMs?: number;
  /** Custom predicate to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback called on each retry */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

/**
 * Custom error thrown when all retries are exhausted.
 */
export class RetryExhaustedError extends Error {
  readonly lastError: unknown;
  readonly attempts: number;

  constructor(lastError: unknown, attempts: number) {
    const message = `Retry exhausted after ${attempts} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`;
    super(message);
    this.name = 'RetryExhaustedError';
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

/**
 * Check if an error is a network-related error.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('fetch failed')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Predicate: retryable AI/Stripe errors (429 rate limit, 5xx server errors, network errors).
 */
export function isRetryableAIError(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return status === 429 || status >= 500;
  }
  return false;
}

/** Standard retry options for AI API calls */
export const AI_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 5000,
  isRetryable: isRetryableAIError,
};

/** Standard retry options for Stripe API calls */
export const STRIPE_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  initialDelayMs: 500,
  backoffMultiplier: 2,
  maxDelayMs: 3000,
  isRetryable: isRetryableAIError,
};

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws RetryExhaustedError if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelayMs = DEFAULT_OPTIONS.initialDelayMs,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    isRetryable,
    onRetry,
  } = options || {};

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If not retryable, throw immediately
      if (isRetryable && !isRetryable(error)) {
        throw error;
      }

      // If this was the last attempt, break
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );

      // Call onRetry callback
      onRetry?.(error, attempt + 1, delayMs);

      await delay(delayMs);
    }
  }

  throw new RetryExhaustedError(lastError, maxRetries + 1);
}
