import { describe, it, expect, vi } from 'vitest';
import { createSSEStream, SSE_HEADERS, DEFAULT_KEEPALIVE_INTERVAL_MS } from './sse';

describe('SSE Utilities', () => {
  describe('SSE_HEADERS', () => {
    it('should have correct content type', () => {
      expect(SSE_HEADERS['Content-Type']).toBe('text/event-stream');
    });

    it('should include nginx proxy compatibility header', () => {
      expect(SSE_HEADERS['X-Accel-Buffering']).toBe('no');
    });
  });

  describe('DEFAULT_KEEPALIVE_INTERVAL_MS', () => {
    it('should be 20 seconds (safe for Vercel)', () => {
      expect(DEFAULT_KEEPALIVE_INTERVAL_MS).toBe(20_000);
    });
  });

  describe('createSSEStream', () => {
    it('should create a Response with correct headers', () => {
      const response = createSSEStream(async () => {});

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
      expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    });

    it('should send events in correct SSE format', async () => {
      const events: string[] = [];

      const response = createSSEStream(async (sse) => {
        sse.send({ type: 'start', id: '123' });
        sse.send({ type: 'content', text: 'Hello' });
        sse.send({ type: 'done' });
      });

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        events.push(decoder.decode(value));
      }

      const fullOutput = events.join('');
      expect(fullOutput).toContain('data: {"type":"start","id":"123"}\n\n');
      expect(fullOutput).toContain('data: {"type":"content","text":"Hello"}\n\n');
      expect(fullOutput).toContain('data: {"type":"done"}\n\n');
    });

    it('should await async onUnhandledError callback', async () => {
      const callOrder: string[] = [];
      const testError = new Error('Test failure');

      const response = createSSEStream(
        async () => {
          throw testError;
        },
        async (error) => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          callOrder.push('error_handler');
          expect(error).toBe(testError);
        }
      );

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          callOrder.push('stream_closed');
          break;
        }
        chunks.push(decoder.decode(value));
      }

      // Error handler should complete before stream closes
      expect(callOrder).toEqual(['error_handler', 'stream_closed']);
      expect(chunks.join('')).toContain('data: {"type":"error","message":"An unexpected error occurred"}\n\n');
    });

    it('should handle error events via controller', async () => {
      const response = createSSEStream(async (sse) => {
        sse.send({ type: 'start' });
        sse.error('Something went wrong');
        sse.send({ type: 'after_error' }); // Can continue after error
      });

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const fullOutput = chunks.join('');
      expect(fullOutput).toContain('data: {"type":"start"}\n\n');
      expect(fullOutput).toContain('data: {"type":"error","message":"Something went wrong"}\n\n');
      expect(fullOutput).toContain('data: {"type":"after_error"}\n\n');
    });

    it('should close stream after handler completes', async () => {
      let streamClosed = false;

      const response = createSSEStream(async (sse) => {
        sse.send({ type: 'done' });
      });

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) {
          streamClosed = true;
          break;
        }
      }

      expect(streamClosed).toBe(true);
    });

    it('should handle sync onUnhandledError callback', async () => {
      const onError = vi.fn();
      const testError = new Error('Test failure');

      const response = createSSEStream(
        async () => {
          throw testError;
        },
        onError
      );

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('should work without onUnhandledError callback', async () => {
      const response = createSSEStream(async () => {
        throw new Error('Unhandled');
      });

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      // Should still send generic error and close cleanly
      expect(chunks.join('')).toContain('data: {"type":"error","message":"An unexpected error occurred"}\n\n');
    });

    it('should accept options object with onUnhandledError', async () => {
      const onError = vi.fn();
      const testError = new Error('Test failure');

      const response = createSSEStream(
        async () => {
          throw testError;
        },
        { onUnhandledError: onError }
      );

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('should disable keepalive when interval is 0', async () => {
      vi.useFakeTimers();

      let handlerCompleted = false;
      const response = createSSEStream(
        async (sse) => {
          sse.send({ type: 'start' });
          // Simulate some async work
          await Promise.resolve();
          sse.send({ type: 'done' });
          handlerCompleted = true;
        },
        { keepaliveIntervalMs: 0 }
      );

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      // Advance time past when keepalive would fire
      vi.advanceTimersByTime(25000);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      const fullOutput = chunks.join('');
      // Should NOT contain keepalive comments
      expect(fullOutput).not.toContain(': keepalive');
      expect(handlerCompleted).toBe(true);

      vi.useRealTimers();
    });

    it('should send keepalive comments at specified interval', async () => {
      vi.useFakeTimers();

      let resolveHandler: () => void;
      const handlerPromise = new Promise<void>(resolve => {
        resolveHandler = resolve;
      });

      const response = createSSEStream(
        async (sse) => {
          sse.send({ type: 'start' });
          // Wait for external signal to complete
          await handlerPromise;
          sse.send({ type: 'done' });
        },
        { keepaliveIntervalMs: 100 } // Short interval for testing
      );

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      // Read initial event
      const { value: firstValue } = await reader.read();
      expect(decoder.decode(firstValue)).toContain('data: {"type":"start"}');

      // Advance time to trigger keepalive
      vi.advanceTimersByTime(150);

      // Read keepalive
      const { value: keepaliveValue } = await reader.read();
      expect(decoder.decode(keepaliveValue)).toBe(': keepalive\n\n');

      // Complete the handler
      resolveHandler!();

      // Read remaining events
      const chunks: string[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(decoder.decode(value));
      }

      expect(chunks.join('')).toContain('data: {"type":"done"}');

      vi.useRealTimers();
    });

    it('should clean up keepalive timer on completion', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const response = createSSEStream(
        async (sse) => {
          sse.send({ type: 'done' });
        },
        { keepaliveIntervalMs: 1000 }
      );

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should clean up keepalive timer on error', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const response = createSSEStream(
        async () => {
          throw new Error('Test error');
        },
        { keepaliveIntervalMs: 1000 }
      );

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();

      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should clean up keepalive timer when reader cancels (client disconnect)', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      let resolveHandler: () => void;
      const handlerPromise = new Promise<void>(resolve => {
        resolveHandler = resolve;
      });

      const response = createSSEStream(
        async (sse) => {
          sse.send({ type: 'start' });
          // Simulate long-running operation
          await handlerPromise;
        },
        { keepaliveIntervalMs: 1000 }
      );

      expect(response.body).not.toBeNull();
      const reader = response.body!.getReader();

      // Read initial event
      await reader.read();

      // Simulate client disconnect by canceling the reader
      await reader.cancel();

      // Timer should be cleaned up via cancel() handler
      expect(clearIntervalSpy).toHaveBeenCalled();

      // Clean up: resolve the promise so handler can finish
      resolveHandler!();
      clearIntervalSpy.mockRestore();
    });
  });
});
