
import { supabase } from '@/integrations/supabase/client';
import { errorLogger } from './error-logger';

interface MemoryUsage {
  total: number;
  used: number;
  free: number;
}

interface PerformanceMetrics {
  operationName: string;
  duration: number;
  memoryUsage: {
    before: MemoryUsage;
    after: MemoryUsage;
    delta: number;
  };
  timestamp: string;
  success: boolean;
  error?: string;
}

const PERFORMANCE_THRESHOLDS = {
  SLOW_OPERATION: 5000, // 5 seconds
  HIGH_MEMORY: 500 * 1024 * 1024, // 500MB
};

export async function withPerformanceMonitoring<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const memoryBefore = getMemoryUsage();
  
  if (import.meta.env.DEV) {
    await errorLogger.info(`Starting performance monitoring: ${operationName}`, {
      timestamp: new Date().toISOString(),
      memoryBefore
    });
  }
  
  try {
    const result = await operation();
    const endTime = Date.now();
    const memoryAfter = getMemoryUsage();
    const duration = endTime - startTime;
    
    // Log performance metrics
    const metrics: PerformanceMetrics = {
      operationName,
      duration,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        delta: memoryAfter.used - memoryBefore.used
      },
      timestamp: new Date().toISOString(),
      success: true
    };
    
    if (import.meta.env.DEV) {
      await errorLogger.info(`Completed ${operationName}`, {
        duration: `${duration}ms`,
        memoryDelta: `${Math.round(metrics.memoryUsage.delta / 1024 / 1024 * 100) / 100}MB`
      });
    }
    
    // Store metrics for analysis
    await storeMetrics(metrics);
    
    // Alert on slow operations
    if (duration > PERFORMANCE_THRESHOLDS.SLOW_OPERATION) {
      await errorLogger.warning(`Slow operation detected: ${operationName} took ${duration}ms`);
    }
    
    // Alert on high memory usage
    if (memoryAfter.used > PERFORMANCE_THRESHOLDS.HIGH_MEMORY) {
      await errorLogger.warning(`High memory usage detected: ${Math.round(memoryAfter.used / 1024 / 1024)}MB`);
    }
    
    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const metrics: PerformanceMetrics = {
      operationName,
      duration,
      memoryUsage: {
        before: memoryBefore,
        after: getMemoryUsage(),
        delta: 0
      },
      timestamp: new Date().toISOString(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    await errorLogger.error(`Failed ${operationName}`, {
      duration: `${duration}ms`,
      error: metrics.error
    });
    
    await storeMetrics(metrics);
    throw error;
  }
}

function getMemoryUsage(): MemoryUsage {
  // In browser environment, use performance.memory if available
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
    const memory = (window.performance as any).memory;
    return {
      total: memory.jsHeapSizeLimit || 0,
      used: memory.usedJSHeapSize || 0,
      free: (memory.jsHeapSizeLimit || 0) - (memory.usedJSHeapSize || 0),
    };
  }
  
  // Fallback for environments without memory API
  return {
    total: 0,
    used: 0,
    free: 0,
  };
}

const metricsStore: PerformanceMetrics[] = [];

async function storeMetrics(metrics: PerformanceMetrics): Promise<void> {
  metricsStore.push(metrics);
  
  // Track performance metrics for analysis
  if (import.meta.env.DEV) {
    await errorLogger.trackPerformance(metrics.operationName, metrics.duration, {
      success: metrics.success,
      memoryDelta: metrics.memoryUsage.delta
    });
  }
}

export async function refreshAnalyticsViews(): Promise<void> {
  return withPerformanceMonitoring('refresh-analytics-views', async () => {
    try {
      await errorLogger.info('Refreshing analytics materialized views');
      
      // Use the refresh function that was created in the migration
      const { error } = await supabase.rpc('refresh_analytics_views' as any);
      
      if (error) {
        await errorLogger.error('Error refreshing analytics views', { error: error.message });
        throw error;
      }
      
      await errorLogger.info('Analytics views refreshed successfully');
    } catch (error: any) {
      await errorLogger.error('Failed to refresh analytics views', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  });
}

// Example usage in a scheduled task or background job
export async function runPeriodicTasks(): Promise<void> {
  await errorLogger.info('Running periodic tasks');
  
  try {
    await refreshAnalyticsViews();
    await errorLogger.info('Periodic tasks completed successfully');
  } catch (error) {
    await errorLogger.error('Periodic tasks failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

// Simulate a scheduled task (e.g., using setTimeout or a cron library)
// setInterval(runPeriodicTasks, 24 * 60 * 60 * 1000); // Every 24 hours
