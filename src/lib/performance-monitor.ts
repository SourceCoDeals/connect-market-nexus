import { supabase } from '@/integrations/supabase/client';

interface QueryPerformanceMetrics {
  queryName: string;
  duration: number;
  timestamp: string;
  success: boolean;
  error?: string;
}

class PerformanceMonitor {
  private metrics: QueryPerformanceMetrics[] = [];
  private isEnabled = process.env.NODE_ENV === 'development';

  async measureQuery<T>(
    queryName: string,
    queryFunction: () => Promise<T>
  ): Promise<T> {
    if (!this.isEnabled) {
      return queryFunction();
    }

    const startTime = performance.now();
    const timestamp = new Date().toISOString();
    
    try {
      const result = await queryFunction();
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        queryName,
        duration,
        timestamp,
        success: true
      });
      
      console.log(`🔍 Query "${queryName}" completed in ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        queryName,
        duration,
        timestamp,
        success: false,
        error: error.message
      });
      
      console.error(`❌ Query "${queryName}" failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  private recordMetric(metric: QueryPerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  getMetrics(): QueryPerformanceMetrics[] {
    return [...this.metrics];
  }

  getSlowQueries(thresholdMs: number = 1000): QueryPerformanceMetrics[] {
    return this.metrics.filter(m => m.duration > thresholdMs);
  }

  async refreshAnalyticsViews(): Promise<void> {
    if (!this.isEnabled) return;
    
    try {
      console.log('🔄 Refreshing materialized views...');
      
      const { error } = await supabase.rpc('refresh_analytics_views');
      
      if (error) {
        console.error('❌ Failed to refresh analytics views:', error);
        throw error;
      }
      
      console.log('✅ Analytics views refreshed successfully');
    } catch (error: any) {
      console.error('❌ Error refreshing analytics views:', error);
      throw error;
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Helper function to wrap queries with performance monitoring
export const withPerformanceMonitoring = async <T>(
  queryName: string,
  queryFunction: () => Promise<T>
): Promise<T> => {
  return performanceMonitor.measureQuery(queryName, queryFunction);
};
