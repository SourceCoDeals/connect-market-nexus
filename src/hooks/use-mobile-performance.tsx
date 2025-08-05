import { useState, useEffect, useCallback, useMemo } from 'react';
import { useIsMobile } from './use-mobile';

interface LazyComponentOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

interface PerformanceMetrics {
  renderTime: number;
  networkSpeed: 'slow' | 'medium' | 'fast';
  isLowPowerMode: boolean;
  shouldReduceAnimations: boolean;
}

export function useLazyComponent(options: LazyComponentOptions = {}) {
  const { threshold = 0.1, rootMargin = '100px', enabled = true } = options;
  const [isVisible, setIsVisible] = useState(!enabled);
  const [elementRef, setElementRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !elementRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(elementRef);

    return () => {
      if (elementRef) observer.unobserve(elementRef);
    };
  }, [elementRef, threshold, rootMargin, enabled]);

  return {
    isVisible,
    ref: setElementRef,
  };
}

export function usePerformanceMetrics(): PerformanceMetrics {
  const isMobile = useIsMobile();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    networkSpeed: 'medium',
    isLowPowerMode: false,
    shouldReduceAnimations: false,
  });

  useEffect(() => {
    const measurePerformance = () => {
      // Measure render time
      const startTime = performance.now();
      requestAnimationFrame(() => {
        const renderTime = performance.now() - startTime;
        
        // Estimate network speed based on connection API
        let networkSpeed: 'slow' | 'medium' | 'fast' = 'medium';
        if ('connection' in navigator) {
          const connection = (navigator as any).connection;
          if (connection) {
            const effectiveType = connection.effectiveType;
            if (effectiveType === 'slow-2g' || effectiveType === '2g') {
              networkSpeed = 'slow';
            } else if (effectiveType === '4g') {
              networkSpeed = 'fast';
            }
          }
        }

        // Check for low power mode indicators
        const isLowPowerMode = isMobile && (
          renderTime > 50 || // Slow rendering
          (typeof navigator !== 'undefined' && 'getBattery' in navigator)
        );

        // Decide if animations should be reduced
        const shouldReduceAnimations = 
          isLowPowerMode || 
          networkSpeed === 'slow' || 
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        setMetrics({
          renderTime,
          networkSpeed,
          isLowPowerMode,
          shouldReduceAnimations,
        });
      });
    };

    measurePerformance();
    
    // Re-measure periodically
    const interval = setInterval(measurePerformance, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [isMobile]);

  return metrics;
}

export function useOptimizedQuery<T>(
  queryFn: () => Promise<T>,
  dependencies: any[] = [],
  options: { enabled?: boolean; staleTime?: number; cacheTime?: number } = {}
) {
  const { networkSpeed } = usePerformanceMetrics();
  const isMobile = useIsMobile();
  
  const optimizedOptions = useMemo(() => {
    const baseOptions = {
      enabled: options.enabled ?? true,
      staleTime: options.staleTime ?? 5 * 60 * 1000, // 5 minutes
      cacheTime: options.cacheTime ?? 10 * 60 * 1000, // 10 minutes
    };

    // Adjust for slow networks
    if (networkSpeed === 'slow') {
      baseOptions.staleTime = 10 * 60 * 1000; // 10 minutes
      baseOptions.cacheTime = 30 * 60 * 1000; // 30 minutes
    }

    // More aggressive caching on mobile
    if (isMobile) {
      baseOptions.cacheTime = Math.max(baseOptions.cacheTime, 15 * 60 * 1000); // At least 15 minutes
    }

    return baseOptions;
  }, [networkSpeed, isMobile, options]);

  return optimizedOptions;
}

export function useNetworkAwareLoading() {
  const { networkSpeed } = usePerformanceMetrics();
  const isMobile = useIsMobile();

  return useMemo(() => {
    const isSlowNetwork = networkSpeed === 'slow';
    const shouldUseLowQuality = isSlowNetwork || isMobile;
    
    return {
      // Chart optimization
      chartAnimationDuration: isSlowNetwork ? 0 : isMobile ? 300 : 500,
      chartPointCount: isSlowNetwork ? 10 : isMobile ? 20 : 50,
      
      // Image optimization
      imageQuality: shouldUseLowQuality ? 'low' : 'high',
      shouldLazyLoad: isMobile || isSlowNetwork,
      
      // Component optimization
      enableVirtualization: isMobile,
      reducedAnimations: isSlowNetwork,
      
      // Data fetching
      batchSize: isSlowNetwork ? 5 : isMobile ? 10 : 20,
      retryAttempts: isSlowNetwork ? 1 : 3,
    };
  }, [networkSpeed, isMobile]);
}

// Custom hook for optimized mobile tables
export function useMobileTableOptimization<T>(
  data: T[],
  itemsPerPage: number = 10
) {
  const isMobile = useIsMobile();
  const { enableVirtualization } = useNetworkAwareLoading();
  const [currentPage, setCurrentPage] = useState(0);
  
  const paginatedData = useMemo(() => {
    if (!enableVirtualization) return data;
    
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage, enableVirtualization]);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  
  return {
    paginatedData,
    currentPage,
    totalPages,
    setCurrentPage,
    hasNextPage: currentPage < totalPages - 1,
    hasPreviousPage: currentPage > 0,
    isVirtualized: enableVirtualization,
  };
}