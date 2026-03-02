import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Loader2, ListChecks } from 'lucide-react';
import { SectionCard } from './shared';
import type { AddLogFn } from './shared';

const statusColor: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  processing: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  completed: 'bg-green-500/15 text-green-700 border-green-500/30',
  failed: 'bg-red-500/15 text-red-700 border-red-500/30',
  paused: 'bg-gray-500/15 text-gray-600 border-gray-500/30',
};

export default function QueueSection({ addLog }: { addLog: AddLogFn }) {
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [queue, setQueue] = useState<
    Database['public']['Tables']['enrichment_queue']['Row'][] | null
  >(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data,
        count: c,
        error: qErr,
      } = await supabase
        .from('enrichment_queue')
        .select('*', { count: 'exact' })
        .order('queued_at', { ascending: false })
        .limit(20);
      if (qErr) throw qErr;
      setQueue(data);
      setCount(c);
      addLog(`Fetched queue \u2014 ${c ?? 0} total items`);
    } catch (e: unknown) {
      setError((e as Error).message);
      addLog(`Queue fetch \u2014 ${(e as Error).message}`, undefined, false);
    } finally {
      setLoading(false);
    }
  };

  const triggerWorker = async () => {
    setTriggerLoading(true);
    const t0 = Date.now();
    try {
      const { error: fnErr } = await supabase.functions.invoke('process-enrichment-queue', {
        body: { source: 'test_dashboard' },
      });
      const dur = Date.now() - t0;
      if (fnErr) {
        addLog(`process-enrichment-queue \u2014 ${fnErr}`, dur, false);
      } else {
        addLog(`process-enrichment-queue triggered`, dur);
      }
    } catch (e: unknown) {
      addLog(`process-enrichment-queue \u2014 ${(e as Error).message}`, Date.now() - t0, false);
    } finally {
      setTriggerLoading(false);
    }
  };

  return (
    <SectionCard title="Queue Enrichment Test" icon={<ListChecks className="h-5 w-5" />}>
      <div className="flex gap-2">
        <Button onClick={fetchQueue} disabled={loading} variant="outline">
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Fetch Queue Status
        </Button>
        <Button onClick={triggerWorker} disabled={triggerLoading}>
          {triggerLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Trigger Queue Worker
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {count !== null && (
        <p className="text-sm text-muted-foreground">Total items in queue: {count}</p>
      )}

      {queue && queue.length > 0 && (
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>listing_id</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Last Error</TableHead>
                <TableHead>Queued At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.listing_id ?? item.id}</TableCell>
                  <TableCell>
                    <Badge className={statusColor[item.status] ?? ''}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>{item.attempts ?? 0}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate text-destructive">
                    {item.last_error ?? '\u2014'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.queued_at ? new Date(item.queued_at).toLocaleString() : '\u2014'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
