/**
 * Server-Sent Events (SSE) utilities for streaming responses.
 *
 * Provides a clean abstraction for creating SSE streams with
 * consistent encoding, error handling, keepalive support, and proper formatting.
 *
 * @example
 * ```typescript
 * import { createSSEStream } from '@/lib/api/sse';
 *
 * return createSSEStream(async (sse) => {
 *   sse.send({ type: 'start', id: '123' });
 *
 *   try {
 *     for await (const chunk of streamData()) {
 *       sse.send({ type: 'content', text: chunk });
 *     }
 *     sse.send({ type: 'done' });
 *   } catch (error) {
 *     // Handle error and save state before stream closes
 *     await saveErrorState(error);
 *     sse.error('Something went wrong');
 *   }
 * });
 * ```
 */

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export interface SSEController {
  /** Send an event to the client */
  send: (event: SSEEvent) => void;
  /** Send an error event to the client (does not close stream) */
  error: (message: string) => void;
}

type SSEHandler = (controller: SSEController) => Promise<void>;

export interface SSEOptions {
  /**
   * Callback for logging unhandled errors.
   * Called before the generic error event is sent.
   */
  onUnhandledError?: (error: unknown) => void | Promise<void>;

  /**
   * Interval in milliseconds for sending keepalive comments.
   * Set to 0 to disable keepalives.
   *
   * Default: 20000 (20 seconds) - safe for Vercel's 25s function timeout.
   *
   * Common proxy timeouts:
   * - Vercel: 25s (standard), 60s (pro)
   * - nginx: 60s (proxy_read_timeout)
   * - AWS ALB: 60s
   * - Cloudflare: 600s
   */
  keepaliveIntervalMs?: number;
}

/**
 * Standard SSE headers for streaming responses.
 *
 * Includes X-Accel-Buffering for nginx proxy compatibility.
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

/** Default keepalive interval - 20 seconds (safe for Vercel) */
export const DEFAULT_KEEPALIVE_INTERVAL_MS = 20_000;

/**
 * Create a Server-Sent Events streaming response.
 *
 * The handler is responsible for its own error handling. Any unhandled
 * errors will result in a generic error event being sent before the
 * stream closes.
 *
 * Keepalives are sent as SSE comments (`:` followed by newlines) which
 * browsers safely ignore but keep the connection alive through proxies.
 *
 * @param handler - Async function that sends events via the controller
 * @param options - Optional configuration (keepalive interval, error callback)
 */
export function createSSEStream(
  handler: SSEHandler,
  options: SSEOptions | ((error: unknown) => void | Promise<void>) = {}
): Response {
  // Support legacy signature: createSSEStream(handler, onUnhandledError)
  const opts: SSEOptions =
    typeof options === 'function' ? { onUnhandledError: options } : options;

  const {
    onUnhandledError,
    keepaliveIntervalMs = DEFAULT_KEEPALIVE_INTERVAL_MS,
  } = opts;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      const sse: SSEController = {
        send: (event) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        },
        error: (message) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
          );
        },
      };

      try {
        // Start keepalive timer if enabled
        if (keepaliveIntervalMs > 0) {
          keepaliveTimer = setInterval(() => {
            // SSE comment format - browsers ignore this but it keeps connection alive
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          }, keepaliveIntervalMs);
        }

        await handler(sse);
      } catch (error) {
        // Await the error callback if provided
        if (onUnhandledError) {
          await onUnhandledError(error);
        }
        sse.error('An unexpected error occurred');
      } finally {
        // Always clean up the keepalive timer
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: SSE_HEADERS,
  });
}
