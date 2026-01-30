import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface ActivityHeatmapProps {
  data: Array<{
    dayOfWeek: number;
    hour: number;
    count: number;
  }>;
  className?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function ActivityHeatmap({ data, className }: ActivityHeatmapProps) {
  const { heatmapGrid, maxCount } = useMemo(() => {
    const grid: Record<string, number> = {};
    let max = 0;
    
    data.forEach(item => {
      const key = `${item.dayOfWeek}-${item.hour}`;
      grid[key] = item.count;
      if (item.count > max) max = item.count;
    });
    
    return { heatmapGrid: grid, maxCount: max };
  }, [data]);

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-muted/30';
    const intensity = count / maxCount;
    if (intensity < 0.25) return 'bg-coral-100 dark:bg-coral-100/20';
    if (intensity < 0.5) return 'bg-coral-200 dark:bg-coral-200/30';
    if (intensity < 0.75) return 'bg-coral-400 dark:bg-coral-400/50';
    return 'bg-coral-500 dark:bg-coral-500/70';
  };

  return (
    <div className={cn(
      "rounded-2xl bg-card border border-border/50 p-6",
      className
    )}>
      {/* Header */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Activity Heatmap
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          When users are most active (by hour and day)
        </p>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          {/* Hour labels (top) */}
          <div className="flex ml-10 mb-1">
            {[0, 6, 12, 18].map(hour => (
              <div 
                key={hour} 
                className="text-[9px] text-muted-foreground/60"
                style={{ width: `${(100 / 4)}%` }}
              >
                {hour === 0 ? '12a' : hour === 12 ? '12p' : hour < 12 ? `${hour}a` : `${hour - 12}p`}
              </div>
            ))}
          </div>

          {/* Grid */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <span className="text-[10px] text-muted-foreground w-8 text-right">
                {day}
              </span>
              <div className="flex-1 flex gap-0.5">
                {HOURS.map(hour => {
                  const count = heatmapGrid[`${dayIndex}-${hour}`] || 0;
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex-1 h-4 rounded-sm transition-all duration-200 hover:ring-1 hover:ring-foreground/20",
                        getColor(count)
                      )}
                      title={`${day} ${hour}:00 - ${count} sessions`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-[10px] text-muted-foreground">Less</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-3 rounded-sm bg-muted/30" />
          <div className="w-4 h-3 rounded-sm bg-coral-100 dark:bg-coral-100/20" />
          <div className="w-4 h-3 rounded-sm bg-coral-200 dark:bg-coral-200/30" />
          <div className="w-4 h-3 rounded-sm bg-coral-400 dark:bg-coral-400/50" />
          <div className="w-4 h-3 rounded-sm bg-coral-500 dark:bg-coral-500/70" />
        </div>
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}
