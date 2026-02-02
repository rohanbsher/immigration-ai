/**
 * Server-Sent Events (SSE) utilities for streaming responses.
 *
 * Provides a clean abstraction for creating SSE streams with
 * consistent encoding, error handling, and proper formatting.
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

/**
 * Create a Server-Sent Events streaming response.
 *
 * The handler is responsible for its own error handling. Any unhandled
 * errors will result in a generic error event being sent before the
 * stream closes.
 *
 * @param handler - Async function that sends events via the controller
 * @param onUnhandledError - Optional callback for logging unhandled errors
 */
export function createSSEStream(
  handler: SSEHandler,
  onUnhandledError?: (error: unknown) => void | Promise<void>
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
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
        await handler(sse);
      } catch (error) {
        // Await the error callback if provided
        if (onUnhandledError) {
          await onUnhandledError(error);
        }
        sse.error('An unexpected error occurred');
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: SSE_HEADERS,
  });
}
