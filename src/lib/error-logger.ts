
import { supabase } from '@/integrations/supabase/client';

export interface ErrorLogEntry {
  error_code: string;
  error_message: string;
  stack_trace?: string;
  user_id?: string;
  correlation_id?: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
}

export class ErrorLogger {
  private static generateCorrelationId(): string {
    return crypto.randomUUID();
  }

  static async logError(entry: Omit<ErrorLogEntry, 'correlation_id'>) {
    const correlationId = this.generateCorrelationId();
    
    try {
      // Log to console for immediate debugging
      console.error(`[${entry.severity.toUpperCase()}] ${entry.error_code}: ${entry.error_message}`, {
        correlationId,
        userId: entry.user_id,
        source: entry.source,
        context: entry.context
      });

      // Send to error logging service
      await supabase.functions.invoke('error-logger', {
        body: {
          ...entry,
          correlation_id: correlationId,
          timestamp: new Date().toISOString()
        }
      });

      return correlationId;
    } catch (error) {
      console.error('Failed to log error:', error);
      // Fallback to console logging only
      return null;
    }
  }

  static async logAuthError(error: any, context: Record<string, any> = {}) {
    return this.logError({
      error_code: 'AUTH_ERROR',
      error_message: error.message || 'Authentication error occurred',
      stack_trace: error.stack,
      user_id: context.user_id,
      context: {
        ...context,
        error_type: error.constructor.name,
        timestamp: new Date().toISOString()
      },
      severity: 'high',
      source: 'authentication'
    });
  }

  static async logFormError(error: any, formType: string, context: Record<string, any> = {}) {
    return this.logError({
      error_code: 'FORM_ERROR',
      error_message: error.message || 'Form validation error',
      stack_trace: error.stack,
      user_id: context.user_id,
      context: {
        ...context,
        form_type: formType,
        timestamp: new Date().toISOString()
      },
      severity: 'medium',
      source: 'form_validation'
    });
  }

  static async logDatabaseError(error: any, operation: string, context: Record<string, any> = {}) {
    return this.logError({
      error_code: 'DATABASE_ERROR',
      error_message: error.message || 'Database operation failed',
      stack_trace: error.stack,
      user_id: context.user_id,
      context: {
        ...context,
        operation,
        timestamp: new Date().toISOString()
      },
      severity: 'high',
      source: 'database'
    });
  }

  static async logPerformanceIssue(metric: string, value: number, threshold: number, context: Record<string, any> = {}) {
    return this.logError({
      error_code: 'PERFORMANCE_ISSUE',
      error_message: `Performance threshold exceeded: ${metric} = ${value}ms (threshold: ${threshold}ms)`,
      context: {
        ...context,
        metric,
        value,
        threshold,
        timestamp: new Date().toISOString()
      },
      severity: 'medium',
      source: 'performance'
    });
  }
}
