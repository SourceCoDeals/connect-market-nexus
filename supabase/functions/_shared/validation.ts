/**
 * Input Validation Utilities
 *
 * Provides type-safe validation for common inputs
 */

import { validationError } from './error-handler.ts';

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: ReturnType<typeof validationError>;
}

/**
 * Validate UUID
 */
export function validateUUID(value: unknown, fieldName: string = 'id'): ValidationResult<string> {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: validationError(`${fieldName} must be a string`, fieldName),
    };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return {
      valid: false,
      error: validationError(`${fieldName} must be a valid UUID`, fieldName),
    };
  }

  return { valid: true, data: value };
}

/**
 * Validate required string
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
  minLength: number = 1,
  maxLength: number = 10000
): ValidationResult<string> {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: validationError(`${fieldName} must be a string`, fieldName),
    };
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return {
      valid: false,
      error: validationError(`${fieldName} must be at least ${minLength} characters`, fieldName),
    };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: validationError(`${fieldName} must be at most ${maxLength} characters`, fieldName),
    };
  }

  return { valid: true, data: trimmed };
}
