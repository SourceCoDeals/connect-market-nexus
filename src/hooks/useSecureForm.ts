/**
 * useSecureForm.ts — Secure form submission hook
 *
 * Wraps form submission with:
 * - Input sanitization (XSS prevention)
 * - CSRF-like token generation (double-submit pattern)
 * - Rate limiting / double-submit prevention
 * - Input validation before submission
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { sanitizeTextInput, sanitizeHtml, sanitizeEmail, sanitizeUrl } from '@/lib/sanitize';
import { createDebouncedSubmission, authRateLimiter } from '@/lib/rate-limiter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecureFormOptions<T> {
  /** The submission handler. Receives sanitized data. */
  onSubmit: (data: T) => Promise<void>;
  /** Validation function. Return error messages or empty array for valid. */
  validate?: (data: T) => string[];
  /** Minimum interval between submissions in ms (default: 2000) */
  minSubmitIntervalMs?: number;
  /** Whether to sanitize string fields (default: true) */
  sanitizeInputs?: boolean;
  /** Whether to generate and validate a CSRF token (default: true) */
  enableCsrf?: boolean;
}

export interface SecureFormResult<T> {
  /** Submit handler — call this from your form's onSubmit */
  handleSubmit: (data: T) => Promise<void>;
  /** Whether a submission is currently in progress */
  isSubmitting: boolean;
  /** Validation errors from the last submission attempt */
  errors: string[];
  /** The CSRF token (embed in a hidden field if needed) */
  csrfToken: string;
  /** Clear all errors */
  clearErrors: () => void;
  /** Reset the form security state */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// CSRF Token Generation
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random CSRF token.
 * Uses crypto.getRandomValues for secure randomness.
 */
function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Store the CSRF token in sessionStorage for double-submit validation.
 */
function storeCsrfToken(token: string): void {
  try {
    sessionStorage.setItem('_csrf_token', token);
  } catch {
    // sessionStorage unavailable (e.g., private browsing); fall through
  }
}

/**
 * Validate that the provided token matches the stored one.
 */
function validateCsrfToken(token: string): boolean {
  try {
    const stored = sessionStorage.getItem('_csrf_token');
    return stored === token;
  } catch {
    // If sessionStorage is unavailable, skip CSRF check
    return true;
  }
}

// ---------------------------------------------------------------------------
// Input Sanitizer
// ---------------------------------------------------------------------------

/**
 * Recursively sanitize all string fields in a data object.
 * Handles nested objects and arrays.
 */
function sanitizeFormData<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return sanitizeTextInput(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeFormData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value === 'string') {
        // Apply specific sanitization based on field name hints
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('email')) {
          sanitized[key] = sanitizeEmail(value) || sanitizeTextInput(value);
        } else if (
          lowerKey.includes('url') ||
          lowerKey.includes('website') ||
          lowerKey.includes('linkedin')
        ) {
          sanitized[key] = sanitizeUrl(value) || sanitizeTextInput(value);
        } else if (
          lowerKey.includes('html') ||
          lowerKey.includes('description_html') ||
          lowerKey.includes('content')
        ) {
          sanitized[key] = sanitizeHtml(value);
        } else {
          sanitized[key] = sanitizeTextInput(value);
        }
      } else {
        sanitized[key] = sanitizeFormData(value);
      }
    }
    return sanitized as T;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for secure form submission.
 *
 * @example
 * ```tsx
 * const { handleSubmit, isSubmitting, errors, csrfToken } = useSecureForm({
 *   onSubmit: async (data) => {
 *     await supabase.from('profiles').update(data).eq('id', user.id);
 *   },
 *   validate: (data) => {
 *     const errs: string[] = [];
 *     if (!data.name) errs.push('Name is required');
 *     return errs;
 *   },
 * });
 *
 * <form onSubmit={(e) => { e.preventDefault(); handleSubmit(formData); }}>
 *   <input type="hidden" name="_csrf" value={csrfToken} />
 *   ...
 * </form>
 * ```
 */
export function useSecureForm<T>(options: SecureFormOptions<T>): SecureFormResult<T> {
  const {
    onSubmit,
    validate,
    minSubmitIntervalMs = 2000,
    sanitizeInputs = true,
    enableCsrf = true,
  } = options;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [csrfToken] = useState<string>(() => {
    const token = generateCsrfToken();
    if (enableCsrf) {
      storeCsrfToken(token);
    }
    return token;
  });

  // Create the debounced submission handler once
  const debouncedSubmitRef = useRef(
    createDebouncedSubmission(
      async (data: T) => {
        await onSubmit(data);
      },
      {
        minIntervalMs: minSubmitIntervalMs,
        rateLimiter: authRateLimiter,
      }
    )
  );

  // Memoize to avoid re-creating on every render
  const handleSubmit = useCallback(
    async (data: T) => {
      setErrors([]);

      // Step 1: CSRF validation
      if (enableCsrf && !validateCsrfToken(csrfToken)) {
        setErrors(['Security token mismatch. Please refresh the page and try again.']);
        return;
      }

      // Step 2: Sanitize inputs
      const processedData = sanitizeInputs ? sanitizeFormData(data) : data;

      // Step 3: Validate
      if (validate) {
        const validationErrors = validate(processedData);
        if (validationErrors.length > 0) {
          setErrors(validationErrors);
          return;
        }
      }

      // Step 4: Submit with debounce guard
      setIsSubmitting(true);
      try {
        const result = await debouncedSubmitRef.current(processedData);
        if (!result.allowed) {
          setErrors([result.reason]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Submission failed. Please try again.';
        setErrors([message]);
      } finally {
        setIsSubmitting(false);
      }
    },
    [csrfToken, enableCsrf, sanitizeInputs, validate]
  );

  const clearErrors = useCallback(() => setErrors([]), []);

  const reset = useCallback(() => {
    setErrors([]);
    setIsSubmitting(false);
  }, []);

  return useMemo(
    () => ({
      handleSubmit,
      isSubmitting,
      errors,
      csrfToken,
      clearErrors,
      reset,
    }),
    [handleSubmit, isSubmitting, errors, csrfToken, clearErrors, reset]
  );
}
