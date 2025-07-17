
import { ErrorLogger } from './error-logger';

export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();
  
  static startMeasurement(key: string): void {
    this.measurements.set(key, performance.now());
  }
  
  static endMeasurement(key: string, threshold?: number): number {
    const startTime = this.measurements.get(key);
    if (!startTime) {
      console.warn(`No start time found for measurement: ${key}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.measurements.delete(key);
    
    console.log(`Performance: ${key} took ${duration}ms`);
    
    // Log performance issues if threshold is exceeded
    if (threshold && duration > threshold) {
      ErrorLogger.logPerformanceIssue(key, duration, threshold, {
        measurement_key: key,
        actual_duration: duration,
        threshold_exceeded: true
      });
    }
    
    return duration;
  }
  
  static async measureAsync<T>(
    key: string, 
    fn: () => Promise<T>, 
    threshold?: number
  ): Promise<T> {
    this.startMeasurement(key);
    try {
      const result = await fn();
      this.endMeasurement(key, threshold);
      return result;
    } catch (error) {
      this.endMeasurement(key);
      throw error;
    }
  }
  
  static measure<T>(key: string, fn: () => T, threshold?: number): T {
    this.startMeasurement(key);
    try {
      const result = fn();
      this.endMeasurement(key, threshold);
      return result;
    } catch (error) {
      this.endMeasurement(key);
      throw error;
    }
  }
}
