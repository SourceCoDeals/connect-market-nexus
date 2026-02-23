/**
 * Structured error handling utilities.
 *
 * Provides:
 * - `AppError` — an Error subclass that carries a machine-readable `code`,
 *   HTTP-style `statusCode`, and freeform `context` metadata.
 * - Helper predicates for classifying errors (`isNetworkError`, `isAuthError`).
 * - `formatErrorMessage` — produces user-friendly copy.
 * - `createErrorReport` — assembles a structured JSON report suitable for
 *   logging / telemetry.
 */

// ---------------------------------------------------------------------------
// AppError
// ---------------------------------------------------------------------------

export type AppErrorCode =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface AppErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;
  public readonly context: AppErrorContext;
  public readonly timestamp: string;

  constructor(
    message: string,
    options: {
      code?: AppErrorCode;
      statusCode?: number;
      context?: AppErrorContext;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = options.code ?? 'UNKNOWN';
    this.statusCode = options.statusCode ?? 500;
    this.context = options.context ?? {};
    this.timestamp = new Date().toISOString();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);

    if (options.cause && 'cause' in Error) {
      (this as unknown as { cause: unknown }).cause = options.cause;
    }
  }

  /** Create an `AppError` from a generic caught value. */
  static from(
    error: unknown,
    context?: AppErrorContext,
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      const code = classifyErrorCode(error);
      const statusCode = inferStatusCode(code);
      return new AppError(error.message, {
        code,
        statusCode,
        context,
        cause: error,
      });
    }

    return new AppError(String(error), {
      code: 'UNKNOWN',
      statusCode: 500,
      context,
    });
  }
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

/** Returns `true` when the error looks like a network / connectivity issue. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT';
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('failed to fetch') ||
      msg.includes('econnrefused') ||
      msg.includes('timeout') ||
      msg.includes('net::err') ||
      error.name === 'TypeError' // fetch throws TypeError on network failure
    );
  }
  return false;
}

/** Returns `true` when the error is authentication/authorization related. */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.code === 'AUTH_ERROR';
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('unauthorized') ||
      msg.includes('unauthenticated') ||
      msg.includes('forbidden') ||
      msg.includes('jwt expired') ||
      msg.includes('invalid token') ||
      msg.includes('session expired') ||
      msg.includes('not authenticated')
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// User-facing messages
// ---------------------------------------------------------------------------

/**
 * Convert an error into a short, user-friendly message suitable for display
 * in a toast or alert.
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return 'Unable to reach the server. Please check your connection and try again.';
      case 'AUTH_ERROR':
        return 'Your session has expired. Please sign in again.';
      case 'VALIDATION_ERROR':
        return error.message || 'The submitted data is invalid. Please check your input.';
      case 'NOT_FOUND':
        return 'The requested resource could not be found.';
      case 'RATE_LIMIT':
        return 'Too many requests. Please wait a moment before trying again.';
      case 'TIMEOUT':
        return 'The request took too long. Please try again.';
      case 'SERVER_ERROR':
        return 'Something went wrong on our end. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  if (isNetworkError(error)) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  if (isAuthError(error)) {
    return 'Your session has expired. Please sign in again.';
  }

  if (error instanceof Error && error.message) {
    // Truncate very long error messages for the UI
    const maxLen = 200;
    return error.message.length > maxLen
      ? error.message.slice(0, maxLen) + '...'
      : error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

// ---------------------------------------------------------------------------
// Structured error report
// ---------------------------------------------------------------------------

export interface ErrorReport {
  message: string;
  code: AppErrorCode;
  statusCode: number;
  context: AppErrorContext;
  stack?: string;
  timestamp: string;
  url: string;
  userAgent: string;
}

/**
 * Build a structured error report that can be serialised to JSON and sent to
 * a logging / telemetry back-end.
 */
export function createErrorReport(
  error: unknown,
  context?: AppErrorContext,
): ErrorReport {
  const appError = error instanceof AppError ? error : AppError.from(error, context);

  return {
    message: appError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    context: { ...appError.context, ...context },
    stack: appError.stack,
    timestamp: appError.timestamp,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function classifyErrorCode(error: Error): AppErrorCode {
  const msg = error.message.toLowerCase();

  if (isNetworkError(error)) return 'NETWORK_ERROR';
  if (isAuthError(error)) return 'AUTH_ERROR';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'TIMEOUT';
  if (msg.includes('not found') || msg.includes('404')) return 'NOT_FOUND';
  if (msg.includes('rate limit') || msg.includes('429')) return 'RATE_LIMIT';
  if (msg.includes('validation') || msg.includes('invalid')) return 'VALIDATION_ERROR';

  return 'UNKNOWN';
}

function inferStatusCode(code: AppErrorCode): number {
  switch (code) {
    case 'NETWORK_ERROR':
      return 0;
    case 'AUTH_ERROR':
      return 401;
    case 'VALIDATION_ERROR':
      return 422;
    case 'NOT_FOUND':
      return 404;
    case 'RATE_LIMIT':
      return 429;
    case 'TIMEOUT':
      return 408;
    case 'SERVER_ERROR':
      return 500;
    default:
      return 500;
  }
}
