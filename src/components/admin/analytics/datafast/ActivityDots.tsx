import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";

interface ActivityDay {
  date: string;
  pageViews: number;
  level: 'none' | 'low' | 'medium' | 'high';
}

interface ActivityDotsProps {
  days: ActivityDay[];
  className?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  'none': 'bg-muted',
  'low': 'bg-[hsl(220_70%_75%)]',
  'medium': 'bg-[hsl(220_70%_55%)]',
  'high': 'bg-[hsl(12_95%_65%)]',
};

export function ActivityDots({ days, className }: ActivityDotsProps) {
  // Take last 7 days
  const displayDays = days.slice(-7);
  
  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn("flex items-center gap-1", className)}>
        {displayDays.map((day) => (
          <Tooltip key={day.date}>
            <TooltipTrigger asChild>
              <div 
                className={cn(
                  "w-2 h-2 rounded-full transition-colors cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-foreground/20",
                  LEVEL_COLORS[day.level]
                )}
              />
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="bg-[hsl(0_0%_15%)] border-[hsl(0_0%_25%)] px-2 py-1"
            >
              <div className="text-[11px] text-white">
                <span className="font-medium">{format(parseISO(day.date), 'MMM d')}</span>
                <span className="text-[hsl(0_0%_65%)] ml-2">{day.pageViews} pages</span>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

// Larger activity calendar for user detail panel
interface ActivityCalendarProps {
  days: ActivityDay[];
  className?: string;
}

export function ActivityCalendar({ days, className }: ActivityCalendarProps) {
  // Group by week
  const weeks: ActivityDay[][] = [];
  let currentWeek: ActivityDay[] = [];
  
  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  
  return (
    <TooltipProvider delayDuration={50}>
      <div className={cn("flex flex-col gap-0.5", className)}>
        {/* Month labels */}
        <div className="flex gap-0.5 mb-1">
          {['J', 'F', 'M', 'A', 'M', 'J'].map((m, i) => (
            <span key={i} className="text-[8px] text-muted-foreground w-6 text-center">{m}</span>
          ))}
        </div>
        
        <div className="flex gap-0.5">
          {weeks.slice(-26).map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5">
              {week.map((day) => (
                <Tooltip key={day.date}>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-[2px] transition-colors cursor-pointer",
                        LEVEL_COLORS[day.level]
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    className="bg-[hsl(0_0%_15%)] border-[hsl(0_0%_25%)] px-2 py-1"
                  >
                    <div className="text-[11px] text-white">
                      <span className="font-medium">{format(parseISO(day.date), 'MMM d, yyyy')}</span>
                      <span className="text-[hsl(0_0%_65%)] ml-2">{day.pageViews} pages</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-1 mt-2">
          <span className="text-[9px] text-muted-foreground">Less</span>
          {['none', 'low', 'medium', 'high'].map((level) => (
            <div 
              key={level}
              className={cn(
                "w-2 h-2 rounded-[2px]",
                LEVEL_COLORS[level as keyof typeof LEVEL_COLORS]
              )}
            />
          ))}
          <span className="text-[9px] text-muted-foreground">More</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
