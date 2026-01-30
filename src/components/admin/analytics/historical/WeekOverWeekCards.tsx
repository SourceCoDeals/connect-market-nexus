import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeekOverWeekCardsProps {
  data: {
    users: { current: number; previous: number; change: number };
    sessions: { current: number; previous: number; change: number };
    pageViews: { current: number; previous: number; change: number };
    conversions: { current: number; previous: number; change: number };
  };
}

export function WeekOverWeekCards({ data }: WeekOverWeekCardsProps) {
  const cards = [
    { label: 'Active Users', ...data.users },
    { label: 'Sessions', ...data.sessions },
    { label: 'Page Views', ...data.pageViews },
    { label: 'Conversions', ...data.conversions },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => (
        <WoWCard key={card.label} {...card} />
      ))}
    </div>
  );
}

function WoWCard({ 
  label, 
  current, 
  previous, 
  change 
}: { 
  label: string; 
  current: number; 
  previous: number; 
  change: number;
}) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label} (WoW)
      </p>
      
      <div className="flex items-end justify-between mt-3">
        <div>
          <p className="text-2xl font-light tracking-tight tabular-nums">
            {current.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            vs {previous.toLocaleString()} prior
          </p>
        </div>
        
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
          isPositive && "bg-green-500/10 text-green-600",
          isNegative && "bg-red-500/10 text-red-600",
          isNeutral && "bg-muted text-muted-foreground"
        )}>
          {isPositive && <TrendingUp className="h-3 w-3" />}
          {isNegative && <TrendingDown className="h-3 w-3" />}
          {isNeutral && <Minus className="h-3 w-3" />}
          <span>{isPositive ? '+' : ''}{change.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
