import { cn } from '@/lib/utils';

interface ConversionLikelihoodBarProps {
  value: number; // 0-100
  className?: string;
}

export function ConversionLikelihoodBar({ value, className }: ConversionLikelihoodBarProps) {
  // Gradient from red (low) to yellow (medium) to green (high)
  const getGradientColor = (val: number) => {
    if (val < 30) return 'from-red-500 to-red-400';
    if (val < 50) return 'from-orange-500 to-yellow-400';
    if (val < 70) return 'from-yellow-400 to-emerald-400';
    return 'from-emerald-400 to-emerald-500';
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-500",
            getGradientColor(value)
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Low</span>
        <span className="font-semibold text-foreground">{value}%</span>
        <span className="text-muted-foreground">High</span>
      </div>
    </div>
  );
}
