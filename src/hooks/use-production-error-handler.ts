import { useCallback } from 'react';
import { errorHandler, ErrorContext, ErrorSeverity } from '@/lib/error-handler';
import { errorLogger } from '@/lib/error-logger';

/**
 * Production-ready error handling hook
 * Provides standardized error handling for components
 */
export const useProductionErrorHandler = (componentName: string) => {
  const handleError = useCallback((
    error: Error | string,
    operation?: string,
    severity: ErrorSeverity = 'medium',
    metadata?: Record<string, any>
  ) => {
    const context: ErrorContext = {
      component: componentName,
      operation,
      metadata
    };

    // Log to both systems for redundancy
    errorHandler(error, context, severity);
    errorLogger.logError(error, context, severity === 'low' ? 'info' : 'error');
  }, [componentName]);

  const handleAsyncError = useCallback(async (
    asyncOperation: () => Promise<any>,
    operationName: string,
    severity: ErrorSeverity = 'medium'
  ) => {
    try {
      return await asyncOperation();
    } catch (error) {
      handleError(error as Error, operationName, severity);
      throw error; // Re-throw to allow component to handle if needed
    }
  }, [handleError]);

  const handleNetworkError = useCallback((
    error: Error | string,
    endpoint?: string,
    metadata?: Record<string, any>
  ) => {
    handleError(
      error,
      `API call to ${endpoint}`,
      'medium',
      { ...metadata, type: 'network_error', endpoint }
    );
  }, [handleError]);

  const handleFormError = useCallback((
    error: Error | string,
    formName?: string,
    fieldErrors?: Record<string, string>
  ) => {
    handleError(
      error,
      `${formName || 'form'} submission`,
      'low',
      { type: 'form_error', fieldErrors }
    );
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
    handleNetworkError,
    handleFormError
  };
};