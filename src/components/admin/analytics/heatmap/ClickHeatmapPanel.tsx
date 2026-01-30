import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { MousePointer, Clock } from "lucide-react";

interface ClickHeatmapPanelProps {
  timeRangeDays: number;
}

interface ClickElement {
  element: string;
  type: string;
  count: number;
}

export function ClickHeatmapPanel({ timeRangeDays }: ClickHeatmapPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['click-heatmap', timeRangeDays],
    queryFn: async () => {
      const startDate = subDays(new Date(), timeRangeDays);
      
      const { data: analytics, error } = await supabase
        .from('listing_analytics')
        .select('clicked_elements')
        .gte('created_at', startDate.toISOString())
        .not('clicked_elements', 'is', null);
      
      if (error) throw error;
      
      // Aggregate click data
      const elementCounts: Record<string, { count: number; type: string; totalTime: number }> = {};
      let totalFirstClickTime = 0;
      let clickTimeCount = 0;
      
      (analytics || []).forEach(row => {
        const clickData = row.clicked_elements as any;
        if (clickData?.clicks && Array.isArray(clickData.clicks)) {
          clickData.clicks.forEach((click: any) => {
            const key = click.element || 'unknown';
            if (!elementCounts[key]) {
              elementCounts[key] = { count: 0, type: click.type || 'unknown', totalTime: 0 };
            }
            elementCounts[key].count += 1;
          });
        }
        
        if (clickData?.first_click_ms) {
          totalFirstClickTime += clickData.first_click_ms;
          clickTimeCount++;
        }
      });
      
      const elements: ClickElement[] = Object.entries(elementCounts)
        .map(([element, data]) => ({
          element: formatElementName(element),
          type: data.type,
          count: data.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      const avgFirstClickTime = clickTimeCount > 0 
        ? Math.round(totalFirstClickTime / clickTimeCount) 
        : 0;
      
      return {
        elements,
        totalClicks: elements.reduce((sum, e) => sum + e.count, 0),
        avgFirstClickTime,
        recordCount: analytics?.length || 0,
      };
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return <Skeleton className="h-[400px] rounded-2xl" />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-card border border-border/50 p-6 text-center">
        <p className="text-muted-foreground">Unable to load click data</p>
      </div>
    );
  }

  if (data.elements.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border/50 p-8 text-center">
        <MousePointer className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No Click Data Yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Click tracking data will appear as users interact with listings
        </p>
      </div>
    );
  }

  const maxClicks = Math.max(...data.elements.map(e => e.count), 1);
  const colors = ['#E57373', '#EF5350', '#F44336', '#E53935', '#D32F2F', '#C62828', '#B71C1C', '#FF8A80', '#FF5252', '#FF1744'];

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Click Heatmap
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Most clicked elements on listing pages
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Clicks</p>
            <p className="text-lg font-light tabular-nums">{data.totalClicks.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Avg First Click
            </p>
            <p className="text-lg font-light tabular-nums">{(data.avgFirstClickTime / 1000).toFixed(1)}s</p>
          </div>
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data.elements} 
            layout="vertical" 
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
            <XAxis 
              type="number" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis 
              type="category" 
              dataKey="element" 
              width={100}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value} clicks`, 'Clicks']}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.elements.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]}
                  opacity={0.8 + (0.2 * (1 - index / data.elements.length))}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Click Type Legend */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/30">
        {data.elements.slice(0, 5).map((elem, i) => (
          <div 
            key={elem.element}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/30 text-xs"
          >
            <span 
              className="h-2 w-2 rounded-full" 
              style={{ backgroundColor: colors[i] }}
            />
            <span className="text-muted-foreground">{elem.element}</span>
            <span className="font-medium">{elem.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatElementName(name: string): string {
  const nameMap: Record<string, string> = {
    'save-button': 'Save Button',
    'contact-cta': 'Contact CTA',
    'contact-button': 'Contact Button',
    'request-intro': 'Request Intro',
    'share-button': 'Share Button',
    'image-gallery': 'Image Gallery',
    'financials-section': 'Financials',
    'description-section': 'Description',
    'unknown': 'Other',
  };
  
  return nameMap[name] || name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
