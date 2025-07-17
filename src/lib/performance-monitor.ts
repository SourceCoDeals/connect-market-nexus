import { supabase } from '@/integrations/supabase/client';

interface MemoryUsage {
  total: number;
  used: number;
  free: number;
}

interface PerformanceMetrics {
  operationName: string;
  duration: number;
  memoryUsage: MemoryUsage;
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
  
  console.log(`🚀 Starting ${operationName}`, {
    timestamp: new Date().toISOString(),
    memoryBefore
  });
  
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
    
    console.log(`✅ Completed ${operationName}`, {
      duration: `${duration}ms`,
      memoryDelta: `${Math.round(metrics.memoryUsage.delta / 1024 / 1024 * 100) / 100}MB`,
      ...metrics
    });
    
    // Store metrics for analysis
    storeMetrics(metrics);
    
    // Alert on slow operations
    if (duration > PERFORMANCE_THRESHOLDS.SLOW_OPERATION) {
      console.warn(`⚠️ Slow operation detected: ${operationName} took ${duration}ms`);
    }
    
    // Alert on high memory usage
    if (memoryAfter.used > PERFORMANCE_THRESHOLDS.HIGH_MEMORY) {
      console.warn(`⚠️ High memory usage detected: ${Math.round(memoryAfter.used / 1024 / 1024)}MB`);
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
    
    console.error(`❌ Failed ${operationName}`, {
      duration: `${duration}ms`,
      error: metrics.error,
      ...metrics
    });
    
    storeMetrics(metrics);
    throw error;
  }
}

function getMemoryUsage(): MemoryUsage {
  const memoryData = process.memoryUsage();
  
  return {
    total: process.memoryUsage().heapTotal,
    used: process.memoryUsage().heapUsed,
    free: memoryData.heapTotal - memoryData.heapUsed,
  };
}

const metricsStore: PerformanceMetrics[] = [];

function storeMetrics(metrics: PerformanceMetrics): void {
  metricsStore.push(metrics);
  
  // Basic logging to console, can be extended to send to monitoring tools
  console.debug('📊 Stored performance metrics:', metrics);
}

export async function refreshAnalyticsViews(): Promise<void> {
  return withPerformanceMonitoring('refresh-analytics-views', async () => {
    try {
      console.log('🔄 Refreshing analytics materialized views');
      
      // Use the refresh function that was created in the migration
      const { error } = await supabase.rpc('refresh_analytics_views');
      
      if (error) {
        console.error('Error refreshing analytics views:', error);
        throw error;
      }
      
      console.log('✅ Analytics views refreshed successfully');
    } catch (error: any) {
      console.error('💥 Failed to refresh analytics views:', error);
      throw error;
    }
  });
}

// Example usage in a scheduled task or background job
export async function runPeriodicTasks(): Promise<void> {
  console.log('⏰ Running periodic tasks...');
  
  try {
    await refreshAnalyticsViews();
    console.log('✅ Periodic tasks completed successfully.');
  } catch (error) {
    console.error('❌ Periodic tasks failed:', error);
  }
}

// Simulate a scheduled task (e.g., using setTimeout or a cron library)
// setInterval(runPeriodicTasks, 24 * 60 * 60 * 1000); // Every 24 hours
