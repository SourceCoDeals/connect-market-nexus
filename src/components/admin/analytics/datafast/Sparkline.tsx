import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  className?: string;
}

export function Sparkline({ 
  data, 
  color = "hsl(12 95% 77%)", 
  height = 24, 
  width = 60,
  className 
}: SparklineProps) {
  const path = useMemo(() => {
    if (!data || data.length === 0) return '';
    
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height * 0.8 - height * 0.1;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  }, [data, height, width]);

  if (!data || data.length === 0) {
    return <div className={cn("opacity-30", className)} style={{ width, height }} />;
  }

  return (
    <svg 
      width={width} 
      height={height} 
      className={cn("overflow-visible", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - Math.min(...data, 0)) / (Math.max(...data, 1) - Math.min(...data, 0) || 1)) * height * 0.8 - height * 0.1}
        r={2}
        fill={color}
      />
    </svg>
  );
}
