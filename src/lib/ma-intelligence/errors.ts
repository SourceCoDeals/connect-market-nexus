/**
 * Standardized error utilities for consistent error handling across the application.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Base application error class with structured error information.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = "UNKNOWN_ERROR",
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Validation error for form/input validation failures.
 */
export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message, "VALIDATION_ERROR", 400, { fieldErrors });
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Not found error for missing resources.
 */
export class NotFoundError extends AppError {
  public readonly resourceType?: string;
  public readonly resourceId?: string;

  constructor(message: string, resourceType?: string, resourceId?: string) {
    super(message, "NOT_FOUND", 404, { resourceType, resourceId });
    this.name = "NotFoundError";
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Unauthorized error for authentication failures.
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "You must be logged in to perform this action") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

/**
 * Forbidden error for authorization failures.
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "You do not have permission to perform this action") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

/**
 * Type guard to check if an error is an AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if an error is a ValidationError.
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Formats an error for user-friendly display.
 * Handles various error types and extracts meaningful messages.
 */
export function formatErrorForUser(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    // Handle Supabase errors
    if ("code" in error && typeof (error as Record<string, unknown>).code === "string") {
      const supabaseError = error as Error & { code: string };
      switch (supabaseError.code) {
        case "PGRST116":
          return "The requested resource was not found.";
        case "23505":
          return "This item already exists.";
        case "23503":
          return "This action cannot be completed due to related data.";
        default:
          return supabaseError.message;
      }
    }
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Formats an error for API/edge function responses.
 * Returns a structured object suitable for JSON responses.
 */
export function formatErrorForAPI(error: unknown): {
  error: string;
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;
} {
  if (isAppError(error)) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      code: "UNKNOWN_ERROR",
      statusCode: 500,
    };
  }

  return {
    error: "An unexpected error occurred",
    code: "UNKNOWN_ERROR",
    statusCode: 500,
  };
}

/**
 * Wraps an async function with error handling.
 * Useful for wrapping API calls with consistent error handling.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw new AppError(
      errorMessage || formatErrorForUser(error),
      "UNKNOWN_ERROR",
      500
    );
  }
}
