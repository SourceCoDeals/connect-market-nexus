import { useState, useEffect } from 'react';

interface ViewportDimensions {
  width: number;
  height: number;
  availableWidth: number;
  availableHeight: number;
}

export function useViewportDimensions(): ViewportDimensions {
  const [dimensions, setDimensions] = useState<ViewportDimensions>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    availableWidth: typeof window !== 'undefined' ? window.innerWidth - 48 : 976, // Account for padding
    availableHeight: typeof window !== 'undefined' ? window.innerHeight - 200 : 568, // Account for header/metrics
  });

  useEffect(() => {
    function handleResize() {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        availableWidth: window.innerWidth - 48, // 24px padding on each side
        availableHeight: window.innerHeight - 200, // Header, metrics, filters
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial size

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return dimensions;
}