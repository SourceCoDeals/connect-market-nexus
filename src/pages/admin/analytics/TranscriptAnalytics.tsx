import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TranscriptHealth } from '@/types/transcript';

export default function TranscriptAnalytics() {
  const { data: health = [], isLoading } = useQuery({
    queryKey: ['transcript-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transcript_extraction_health' as any)
        .select('*');

      if (error) throw error;
      return (data || []) as unknown as TranscriptHealth[];
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Transcript Analytics</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {health.map((table) => (
          <Card key={table.table_name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize">
                {table.table_name.replace(/_/g, ' ')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">{table.total_transcripts}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processed:</span>
                  <span className="font-medium">{table.processed_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className="font-medium">{table.processed_percentage}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
