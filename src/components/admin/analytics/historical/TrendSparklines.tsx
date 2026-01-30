import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface TrendSparklinesProps {
  data: {
    users: Array<{ date: string; value: number }>;
    sessions: Array<{ date: string; value: number }>;
    pageViews: Array<{ date: string; value: number }>;
    conversions: Array<{ date: string; value: number }>;
  };
}

export function TrendSparklines({ data }: TrendSparklinesProps) {
  const sparklines = [
    { label: 'Users Trend', data: data.users, color: '#6366f1' },
    { label: 'Sessions Trend', data: data.sessions, color: 'hsl(var(--coral-500))' },
    { label: 'Page Views Trend', data: data.pageViews, color: 'hsl(var(--peach-500))' },
    { label: 'Conversions Trend', data: data.conversions, color: '#22c55e' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {sparklines.map(spark => (
        <SparklineCard key={spark.label} {...spark} />
      ))}
    </div>
  );
}

function SparklineCard({ 
  label, 
  data, 
  color 
}: { 
  label: string; 
  data: Array<{ date: string; value: number }>; 
  color: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const avg = data.length > 0 ? Math.round(total / data.length) : 0;

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-light tabular-nums mt-1">
        Avg: {avg.toLocaleString()}
      </p>
      
      <div className="h-12 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#gradient-${label})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
