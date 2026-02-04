/**
 * Timeout Handler for Long-Running Operations
 *
 * Provides:
 * - Timeout wrappers for async operations
 * - Early exit detection for edge function limits
 * - Graceful degradation
 */

export interface TimeoutConfig {
  operationTimeout: number;    // Timeout for individual operation (ms)
  functionTimeout?: number;    // Total function timeout (ms)
  gracePeriod?: number;        // Buffer before hard timeout (ms)
}

export interface TimeoutResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timedOut: boolean;
  duration: number;
}

/**
 * Execute async operation with timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string = 'Operation'
): Promise<TimeoutResult<T>> {
  const startTime = Date.now();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    const data = await Promise.race([operation(), timeoutPromise]);
    const duration = Date.now() - startTime;

    return {
      success: true,
      data,
      timedOut: false,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const isTimeout = error instanceof Error && error.message.includes('timed out');

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timedOut: isTimeout,
      duration,
    };
  }
}

/**
 * Function runtime tracker for early exit
 */
export class FunctionTimer {
  private startTime: number;
  private functionTimeoutMs: number;
  private gracePeriodMs: number;

  constructor(config: { functionTimeout: number; gracePeriod?: number }) {
    this.startTime = Date.now();
    this.functionTimeoutMs = config.functionTimeout;
    this.gracePeriodMs = config.gracePeriod || 10000; // Default 10s grace period
  }

  /**
   * Get elapsed time since function start
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get remaining time before timeout
   */
  getRemaining(): number {
    return this.functionTimeoutMs - this.getElapsed();
  }

  /**
   * Check if there's enough time for another operation
   */
  hasTimeFor(operationTimeMs: number): boolean {
    return this.getRemaining() > (operationTimeMs + this.gracePeriodMs);
  }

  /**
   * Check if we're approaching timeout
   */
  isApproachingTimeout(): boolean {
    return this.getRemaining() < this.gracePeriodMs;
  }

  /**
   * Get safe timeout for next operation (with grace period)
   */
  getSafeTimeout(): number {
    return Math.max(1000, this.getRemaining() - this.gracePeriodMs);
  }
}

/**
 * Execute operations in sequence with timeout tracking
 */
export async function executeWithTimeTracking<T>(
  operations: Array<{ name: string; fn: () => Promise<T>; timeout: number }>,
  config: TimeoutConfig
): Promise<{
  results: Array<TimeoutResult<T>>;
  completedCount: number;
  timedOut: boolean;
  totalDuration: number;
}> {
  const timer = new FunctionTimer({
    functionTimeout: config.functionTimeout || 120000,
    gracePeriod: config.gracePeriod || 10000,
  });

  const results: Array<TimeoutResult<T>> = [];
  let completedCount = 0;

  for (const op of operations) {
    // Check if we have time for this operation
    if (!timer.hasTimeFor(op.timeout)) {
      console.warn(`Skipping ${op.name} - insufficient time remaining (${timer.getRemaining()}ms)`);
      results.push({
        success: false,
        error: 'Skipped due to function timeout approaching',
        timedOut: false,
        duration: 0,
      });
      continue;
    }

    // Execute with timeout
    const safeTimeout = Math.min(op.timeout, timer.getSafeTimeout());
    const result = await withTimeout(op.fn, safeTimeout, op.name);

    results.push(result);
    if (result.success) completedCount++;
  }

  return {
    results,
    completedCount,
    timedOut: timer.isApproachingTimeout(),
    totalDuration: timer.getElapsed(),
  };
}

/**
 * Retry with exponential backoff and timeout
 */
export async function retryWithTimeout<T>(
  operation: () => Promise<T>,
  config: {
    maxRetries: number;
    initialDelay: number;
    timeoutMs: number;
    operationName: string;
  }
): Promise<TimeoutResult<T>> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const result = await withTimeout(operation, config.timeoutMs, config.operationName);

    if (result.success) {
      return result;
    }

    lastError = new Error(result.error);

    // Don't retry on timeout
    if (result.timedOut) {
      return result;
    }

    // Wait before retry (exponential backoff)
    if (attempt < config.maxRetries) {
      const delay = config.initialDelay * Math.pow(2, attempt);
      console.log(`${config.operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Max retries exceeded',
    timedOut: false,
    duration: 0,
  };
}
