/**
 * Circuit Breaker for AI service calls.
 *
 * Prevents cascading failures when an AI provider is down by tracking
 * consecutive failures and temporarily rejecting requests.
 *
 * States:
 *   CLOSED  → normal operation, requests pass through
 *   OPEN    → provider is down, requests fail immediately
 *   HALF_OPEN → cooldown expired, next request is a probe
 *
 * Transitions:
 *   CLOSED → OPEN: after `failureThreshold` consecutive failures
 *   OPEN → HALF_OPEN: after `cooldownMs` elapses
 *   HALF_OPEN → CLOSED: on successful probe
 *   HALF_OPEN → OPEN: on failed probe (resets cooldown)
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker "${name}" is open — AI provider is temporarily unavailable`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export interface CircuitBreakerOptions {
  /** Name for logging/identification */
  name: string;
  /** Number of consecutive failures before opening (default: 5) */
  failureThreshold?: number;
  /** Milliseconds to wait before probing (default: 60_000) */
  cooldownMs?: number;
}

export class CircuitBreaker {
  readonly name: string;
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 60_000;
  }

  getState(): CircuitState {
    if (this.state === 'open') {
      // Check if cooldown has elapsed → transition to half_open
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this.state = 'half_open';
      }
    }
    return this.state;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitBreakerOpenError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'open') {
      throw new CircuitBreakerOpenError(this.name);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /** Reset the circuit breaker to closed state (for testing). */
  reset(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }
}

// Singleton breakers for each AI provider
export const anthropicBreaker = new CircuitBreaker({ name: 'anthropic' });
export const openaiBreaker = new CircuitBreaker({ name: 'openai' });
