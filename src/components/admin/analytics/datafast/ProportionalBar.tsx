import { cn } from "@/lib/utils";

interface ProportionalBarProps {
  value: number;
  maxValue: number;
  secondaryValue?: number;
  secondaryMaxValue?: number;
  className?: string;
  children: React.ReactNode;
}

export function ProportionalBar({ 
  value, 
  maxValue, 
  secondaryValue, 
  secondaryMaxValue,
  className,
  children 
}: ProportionalBarProps) {
  const primaryWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const secondaryWidth = secondaryMaxValue && secondaryValue 
    ? (secondaryValue / secondaryMaxValue) * 100 
    : 0;
  
  return (
    <div className={cn("relative py-2 -mx-2 px-2 rounded-lg transition-colors hover:bg-muted/20", className)}>
      {/* Primary background bar (visitors - light coral) */}
      <div 
        className="absolute inset-y-0 left-0 bg-[hsl(12_95%_77%/0.08)] rounded-lg transition-all duration-300"
        style={{ width: `${Math.min(primaryWidth, 100)}%` }}
      />
      
      {/* Secondary overlay bar (connections - deeper coral) */}
      {secondaryValue !== undefined && secondaryWidth > 0 && (
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[hsl(12_95%_65%/0.12)] to-[hsl(12_95%_55%/0.18)] rounded-lg transition-all duration-300"
          style={{ width: `${Math.min(secondaryWidth, 100)}%` }}
        />
      )}
      
      {/* Content on top */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
