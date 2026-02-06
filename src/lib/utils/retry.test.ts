import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  RetryExhaustedError,
  isNetworkError,
} from './retry';

describe('withRetry', () => {
  describe('defaults', () => {
    it('succeeds on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn, { initialDelayMs: 1 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('succeeds on retry after initial failure', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('recovered');

      const result = await withRetry(fn, { initialDelayMs: 1 });
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws RetryExhaustedError when all retries are exhausted', async () => {
      const originalError = new Error('persistent failure');
      const fn = vi.fn().mockRejectedValue(originalError);

      try {
        await withRetry(fn, { initialDelayMs: 1 });
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RetryExhaustedError);
        const retryError = error as RetryExhaustedError;
        expect(retryError.lastError).toBe(originalError);
        expect(retryError.attempts).toBe(4);
      }
    });

    it('throws original error immediately when isRetryable returns false', async () => {
      const originalError = new Error('non-retryable');
      const fn = vi.fn().mockRejectedValue(originalError);

      try {
        await withRetry(fn, {
          initialDelayMs: 1,
          isRetryable: () => false,
        });
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBe(originalError);
        expect(error).not.toBeInstanceOf(RetryExhaustedError);
        expect(fn).toHaveBeenCalledTimes(1);
      }
    });

    it('calls onRetry callback with correct arguments', async () => {
      const onRetry = vi.fn();
      const error = new Error('fail');
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('ok');

      await withRetry(fn, { initialDelayMs: 1, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(error, 1, 1);
    });

    it('tracks correct attempt count when failing twice then succeeding', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('third time');

      const result = await withRetry(fn, { initialDelayMs: 1 });
      expect(result).toBe('third time');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('returns correct generic type', async () => {
      const fn = vi.fn().mockResolvedValue(42);
      const result: number = await withRetry<number>(fn, { initialDelayMs: 1 });
      expect(result).toBe(42);
      expect(typeof result).toBe('number');
    });
  });

  describe('backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('uses exponential delays: 1000ms, 2000ms, 4000ms', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const onRetry = vi.fn();

      let caughtError: unknown;
      const promise = withRetry(fn, { onRetry }).catch((e) => { caughtError = e; });

      // First attempt fails immediately, then waits 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      // Second attempt fails, then waits 2000ms
      await vi.advanceTimersByTimeAsync(2000);
      // Third attempt fails, then waits 4000ms
      await vi.advanceTimersByTimeAsync(4000);

      await promise;

      expect(caughtError).toBeInstanceOf(RetryExhaustedError);
      expect(onRetry).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1, 1000);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2, 2000);
      expect(onRetry).toHaveBeenNthCalledWith(3, expect.any(Error), 3, 4000);
    });

    it('caps delay at maxDelayMs', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const onRetry = vi.fn();

      let caughtError: unknown;
      const promise = withRetry(fn, {
        maxDelayMs: 1500,
        onRetry,
      }).catch((e) => { caughtError = e; });

      // 1st retry: min(1000 * 2^0, 1500) = 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      // 2nd retry: min(1000 * 2^1, 1500) = 1500ms (capped)
      await vi.advanceTimersByTimeAsync(1500);
      // 3rd retry: min(1000 * 2^2, 1500) = 1500ms (capped)
      await vi.advanceTimersByTimeAsync(1500);

      await promise;

      expect(caughtError).toBeInstanceOf(RetryExhaustedError);
      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1, 1000);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2, 1500);
      expect(onRetry).toHaveBeenNthCalledWith(3, expect.any(Error), 3, 1500);
    });

    it('respects custom maxRetries and initialDelayMs', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const onRetry = vi.fn();

      let caughtError: unknown;
      const promise = withRetry(fn, {
        maxRetries: 1,
        initialDelayMs: 500,
        onRetry,
      }).catch((e) => { caughtError = e; });

      // 1st retry: 500ms
      await vi.advanceTimersByTimeAsync(500);

      await promise;

      expect(caughtError).toBeInstanceOf(RetryExhaustedError);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 500);
    });

    it('fails immediately with maxRetries: 0', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('instant fail'));

      let caughtError: unknown;
      const promise = withRetry(fn, { maxRetries: 0 }).catch((e) => { caughtError = e; });

      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(caughtError).toBeInstanceOf(RetryExhaustedError);
      const retryError = caughtError as RetryExhaustedError;
      expect(retryError.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('retries on non-Error throws', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValue('recovered');

      const result = await withRetry(fn, { initialDelayMs: 1 });
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('returns correct generic type for number', async () => {
      const fn = vi.fn().mockResolvedValue(123);
      const result = await withRetry<number>(fn, { initialDelayMs: 1 });
      expect(result).toBe(123);
      expect(typeof result).toBe('number');
    });

    it('does not delay on immediate success', async () => {
      const start = Date.now();
      const fn = vi.fn().mockResolvedValue('fast');

      const result = await withRetry(fn);
      const elapsed = Date.now() - start;

      expect(result).toBe('fast');
      expect(elapsed).toBeLessThan(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});

describe('isNetworkError', () => {
  it('returns true for "Network request failed"', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
  });

  it('returns true for "timeout"', () => {
    expect(isNetworkError(new Error('Connection timeout'))).toBe(true);
  });

  it('returns true for "ECONNREFUSED"', () => {
    expect(isNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:5432'))).toBe(true);
  });

  it('returns false for generic error', () => {
    expect(isNetworkError(new Error('something went wrong'))).toBe(false);
  });

  it('returns false for non-Error value', () => {
    expect(isNetworkError('not an error')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(42)).toBe(false);
  });
});

describe('RetryExhaustedError', () => {
  it('has correct name property', () => {
    const error = new RetryExhaustedError(new Error('oops'), 3);
    expect(error.name).toBe('RetryExhaustedError');
  });

  it('has correct message format with attempt count and original error', () => {
    const original = new Error('connection lost');
    const error = new RetryExhaustedError(original, 4);
    expect(error.message).toBe(
      'Retry exhausted after 4 attempt(s): connection lost'
    );
    expect(error.lastError).toBe(original);
    expect(error.attempts).toBe(4);
  });
});
