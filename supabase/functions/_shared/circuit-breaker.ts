/**
 * Circuit Breaker pattern for external API calls in edge functions.
 *
 * Prevents cascading failures by tracking error rates and temporarily
 * blocking calls to failing services.
 *
 * States:
 * - CLOSED:    Normal operation. Requests pass through. Failures are counted.
 * - OPEN:      Service is failing. Requests are immediately rejected.
 * - HALF_OPEN: Testing recovery. A single request is allowed through.
 *
 * Since Supabase edge functions are short-lived (max ~60s), in-memory state
 * resets on each invocation. This provides per-invocation protection against
 * rapid successive failures within a single function execution (e.g., a queue
 * processor that calls an external API for each item in a batch).
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  failureThreshold: number;
  /** Number of successes in HALF_OPEN before closing the circuit. Default: 2 */
  successThreshold: number;
  /** How long (ms) the circuit stays OPEN before transitioning to HALF_OPEN. Default: 30000 */
  openDurationMs: number;
  /** Name used in log messages. Default: 'CircuitBreaker' */
  name: string;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  openDurationMs: 30000,
  name: 'CircuitBreaker',
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Current state of the circuit. */
  getState(): CircuitState {
    // Check if OPEN circuit should transition to HALF_OPEN
    if (
      this.state === CircuitState.OPEN &&
      Date.now() - this.lastFailureTime >= this.options.openDurationMs
    ) {
      console.log(
        `[${this.options.name}] Circuit transitioning OPEN -> HALF_OPEN (timeout elapsed)`,
      );
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }
    return this.state;
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * - In CLOSED state: executes normally, tracks failures.
   * - In OPEN state: rejects immediately with a CircuitOpenError.
   * - In HALF_OPEN state: allows one call through. On success, transitions
   *   toward CLOSED. On failure, transitions back to OPEN.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      const retryInMs = this.options.openDurationMs - (Date.now() - this.lastFailureTime);
      throw new CircuitOpenError(
        `[${this.options.name}] Circuit is OPEN — rejecting request. Retry in ${Math.round(retryInMs)}ms.`,
        retryInMs,
      );
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

  /** Record a successful call. */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        console.log(
          `[${this.options.name}] Circuit transitioning HALF_OPEN -> CLOSED (${this.successCount} successes)`,
        );
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      // In CLOSED state, reset failure count on success
      this.failureCount = 0;
    }
  }

  /** Record a failed call. */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN immediately reopens the circuit
      console.log(
        `[${this.options.name}] Circuit transitioning HALF_OPEN -> OPEN (failure during test)`,
      );
      this.state = CircuitState.OPEN;
      this.successCount = 0;
    } else if (this.failureCount >= this.options.failureThreshold) {
      console.log(
        `[${this.options.name}] Circuit transitioning CLOSED -> OPEN (${this.failureCount} consecutive failures)`,
      );
      this.state = CircuitState.OPEN;
    }
  }

  /** Reset the circuit breaker to CLOSED state. */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Error thrown when the circuit is OPEN and requests are being rejected.
 * Callers can inspect `retryAfterMs` to know when to try again.
 */
export class CircuitOpenError extends Error {
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}
