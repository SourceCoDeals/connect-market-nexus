/**
 * Standardized Error Handling for All Edge Functions
 *
 * Provides:
 * - Consistent error responses
 * - Error logging with context
 * - Error categorization
 * - User-friendly error messages
 */

export interface ErrorContext {
  functionName: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  EXTERNAL_SERVICE = 'external_service',
  DATABASE = 'database',
  AI_SERVICE = 'ai_service',
  INTERNAL = 'internal',
}

export interface AppError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  statusCode: number;
  retryable: boolean;
  metadata?: Record<string, any>;
}

const ERROR_DEFINITIONS: Record<ErrorCategory, Partial<AppError>> = {
  [ErrorCategory.AUTHENTICATION]: {
    statusCode: 401,
    userMessage: 'Authentication required. Please log in.',
    retryable: false,
  },
  [ErrorCategory.AUTHORIZATION]: {
    statusCode: 403,
    userMessage: 'You do not have permission to perform this action.',
    retryable: false,
  },
  [ErrorCategory.VALIDATION]: {
    statusCode: 400,
    userMessage: 'Invalid request. Please check your input.',
    retryable: false,
  },
  [ErrorCategory.NOT_FOUND]: {
    statusCode: 404,
    userMessage: 'The requested resource was not found.',
    retryable: false,
  },
  [ErrorCategory.RATE_LIMIT]: {
    statusCode: 429,
    userMessage: 'Too many requests. Please try again later.',
    retryable: true,
  },
  [ErrorCategory.TIMEOUT]: {
    statusCode: 504,
    userMessage: 'The operation took too long to complete. Please try again.',
    retryable: true,
  },
  [ErrorCategory.EXTERNAL_SERVICE]: {
    statusCode: 502,
    userMessage: 'An external service is temporarily unavailable. Please try again.',
    retryable: true,
  },
  [ErrorCategory.DATABASE]: {
    statusCode: 500,
    userMessage: 'A database error occurred. Please try again.',
    retryable: true,
  },
  [ErrorCategory.AI_SERVICE]: {
    statusCode: 503,
    userMessage: 'AI service is temporarily unavailable. Please try again.',
    retryable: true,
  },
  [ErrorCategory.INTERNAL]: {
    statusCode: 500,
    userMessage: 'An internal error occurred. Please try again.',
    retryable: true,
  },
};

/**
 * Create standardized error
 */
export function createError(
  category: ErrorCategory,
  message: string,
  metadata?: Record<string, any>
): AppError {
  const definition = ERROR_DEFINITIONS[category];

  return {
    category,
    message,
    userMessage: definition.userMessage || 'An error occurred',
    statusCode: definition.statusCode || 500,
    retryable: definition.retryable || false,
    metadata,
  };
}

/**
 * Log error with context
 */
export function logError(error: Error | AppError | string, context: ErrorContext): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : (error as AppError).message);

  console.error(JSON.stringify({
    timestamp,
    level: 'ERROR',
    function: context.functionName,
    userId: context.userId,
    requestId: context.requestId,
    message: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    metadata: context.metadata,
  }));
}

/**
 * Convert unknown error to AppError
 */
export function normalizeError(error: unknown): AppError {
  // Already an AppError
  if (typeof error === 'object' && error !== null && 'category' in error) {
    return error as AppError;
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('timed out')) {
      return createError(ErrorCategory.TIMEOUT, error.message);
    }
    if (error.message.includes('rate limit')) {
      return createError(ErrorCategory.RATE_LIMIT, error.message);
    }
    if (error.message.includes('not found')) {
      return createError(ErrorCategory.NOT_FOUND, error.message);
    }
    if (error.message.includes('auth')) {
      return createError(ErrorCategory.AUTHENTICATION, error.message);
    }

    return createError(ErrorCategory.INTERNAL, error.message);
  }

  // String error
  if (typeof error === 'string') {
    return createError(ErrorCategory.INTERNAL, error);
  }

  // Unknown error
  return createError(ErrorCategory.INTERNAL, 'An unknown error occurred');
}

/**
 * Create error response
 */
export function errorResponse(
  error: AppError,
  corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: error.userMessage,
      error_code: error.category,
      retryable: error.retryable,
      metadata: error.metadata,
    }),
    {
      status: error.statusCode,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Handle errors in edge functions consistently
 */
export function handleError(
  error: unknown,
  context: ErrorContext,
  corsHeaders?: Record<string, string>
): Response {
  const appError = normalizeError(error);
  logError(appError, context);
  return errorResponse(appError, corsHeaders);
}

/**
 * Try-catch wrapper with automatic error handling
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  corsHeaders?: Record<string, string>
): Promise<T | Response> {
  try {
    return await operation();
  } catch (error) {
    return handleError(error, context, corsHeaders);
  }
}

/**
 * Validation error helper
 */
export function validationError(message: string, field?: string): AppError {
  return createError(ErrorCategory.VALIDATION, message, { field });
}

/**
 * AI service error helper
 */
export function aiServiceError(
  provider: string,
  message: string,
  statusCode?: number
): AppError {
  const category = statusCode === 429 ? ErrorCategory.RATE_LIMIT :
    statusCode === 402 ? ErrorCategory.AI_SERVICE :
      ErrorCategory.AI_SERVICE;

  return createError(category, `${provider}: ${message}`, { provider, statusCode });
}

/**
 * Database error helper
 */
export function databaseError(operation: string, details?: string): AppError {
  return createError(
    ErrorCategory.DATABASE,
    `Database ${operation} failed${details ? `: ${details}` : ''}`,
    { operation, details }
  );
}
