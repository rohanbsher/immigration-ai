import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  anthropicBreaker,
  openaiBreaker,
} from './circuit-breaker';

describe('CircuitBreakerOpenError', () => {
  it('has the correct name and message', () => {
    const error = new CircuitBreakerOpenError('test-breaker');
    expect(error.name).toBe('CircuitBreakerOpenError');
    expect(error.message).toContain('test-breaker');
    expect(error.message).toContain('open');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      cooldownMs: 1000,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('exposes the breaker name', () => {
      expect(breaker.name).toBe('test');
    });
  });

  describe('closed state (normal operation)', () => {
    it('passes through successful calls', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('passes through errors without opening if below threshold', async () => {
      // Fail twice (threshold is 3)
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe('closed');
    });

    it('resets failure count after a success', async () => {
      // Fail twice
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow('fail');
      }

      // Succeed once
      await breaker.execute(async () => 'ok');

      // Fail twice more -- should still be closed because counter was reset
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('transition to open state', () => {
    it('opens after reaching failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe('open');
    });

    it('rejects immediately with CircuitBreakerOpenError when open', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow('fail');
      }

      // Next call should be rejected immediately
      await expect(
        breaker.execute(async () => 'should not run')
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('does not call the function when circuit is open', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
      }

      const fn = vi.fn(async () => 'should not run');
      await expect(breaker.execute(fn)).rejects.toThrow(
        CircuitBreakerOpenError
      );
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('transition to half_open state', () => {
    it('transitions to half_open after cooldown', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
      }

      expect(breaker.getState()).toBe('open');

      // Advance time past cooldown
      vi.advanceTimersByTime(1001);

      expect(breaker.getState()).toBe('half_open');
    });

    it('remains open if cooldown has not elapsed', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
      }

      vi.advanceTimersByTime(500); // Less than cooldownMs

      expect(breaker.getState()).toBe('open');
    });
  });

  describe('half_open state probe', () => {
    async function tripBreaker() {
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
      }
      vi.advanceTimersByTime(1001);
      expect(breaker.getState()).toBe('half_open');
    }

    it('closes circuit on successful probe', async () => {
      await tripBreaker();

      const result = await breaker.execute(async () => 'probe success');
      expect(result).toBe('probe success');
      expect(breaker.getState()).toBe('closed');
    });

    it('reopens circuit on failed probe', async () => {
      await tripBreaker();

      await expect(
        breaker.execute(async () => {
          throw new Error('probe fail');
        })
      ).rejects.toThrow('probe fail');

      expect(breaker.getState()).toBe('open');
    });

    it('after failed probe, needs another cooldown before half_open', async () => {
      await tripBreaker();

      // Fail the probe
      await expect(
        breaker.execute(async () => {
          throw new Error('probe fail');
        })
      ).rejects.toThrow();

      expect(breaker.getState()).toBe('open');

      // Advance time past cooldown again
      vi.advanceTimersByTime(1001);
      expect(breaker.getState()).toBe('half_open');
    });
  });

  describe('reset', () => {
    it('resets to closed state', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
      }

      expect(breaker.getState()).toBe('open');

      breaker.reset();

      expect(breaker.getState()).toBe('closed');
    });

    it('allows calls after reset', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
      }

      breaker.reset();

      const result = await breaker.execute(async () => 'after reset');
      expect(result).toBe('after reset');
    });
  });

  describe('default options', () => {
    it('uses default failureThreshold of 5', async () => {
      const defaultBreaker = new CircuitBreaker({ name: 'default' });

      // 4 failures should keep it closed
      for (let i = 0; i < 4; i++) {
        await expect(
          defaultBreaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
      }
      expect(defaultBreaker.getState()).toBe('closed');

      // 5th failure should open it
      await expect(
        defaultBreaker.execute(async () => {
          throw new Error('fail');
        })
      ).rejects.toThrow();
      expect(defaultBreaker.getState()).toBe('open');
    });

    it('uses default cooldownMs of 60_000', async () => {
      const defaultBreaker = new CircuitBreaker({ name: 'default' });

      for (let i = 0; i < 5; i++) {
        await expect(
          defaultBreaker.execute(async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
      }

      // Advance 59 seconds -- still open
      vi.advanceTimersByTime(59_000);
      expect(defaultBreaker.getState()).toBe('open');

      // Advance past 60 seconds -- half_open
      vi.advanceTimersByTime(2_000);
      expect(defaultBreaker.getState()).toBe('half_open');
    });
  });

  describe('concurrent requests', () => {
    it('handles multiple concurrent successes', async () => {
      const results = await Promise.all([
        breaker.execute(async () => 'a'),
        breaker.execute(async () => 'b'),
        breaker.execute(async () => 'c'),
      ]);

      expect(results).toEqual(['a', 'b', 'c']);
      expect(breaker.getState()).toBe('closed');
    });

    it('handles mix of success and failure concurrently', async () => {
      const results = await Promise.allSettled([
        breaker.execute(async () => 'success'),
        breaker.execute(async () => {
          throw new Error('fail');
        }),
        breaker.execute(async () => 'success'),
      ]);

      expect(results[0]).toEqual({ status: 'fulfilled', value: 'success' });
      expect(results[1].status).toBe('rejected');
      expect(results[2]).toEqual({ status: 'fulfilled', value: 'success' });
    });
  });
});

describe('Singleton breakers', () => {
  it('exports anthropicBreaker with name "anthropic"', () => {
    expect(anthropicBreaker).toBeInstanceOf(CircuitBreaker);
    expect(anthropicBreaker.name).toBe('anthropic');
  });

  it('exports openaiBreaker with name "openai"', () => {
    expect(openaiBreaker).toBeInstanceOf(CircuitBreaker);
    expect(openaiBreaker.name).toBe('openai');
  });
});
