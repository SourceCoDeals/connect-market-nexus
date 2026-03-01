import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FlaskConical } from 'lucide-react';
import { StatusBadge, JsonBlock, ComparisonTable, SectionCard, EntityPicker } from './shared';
import type { AddLogFn } from './shared';

const BUYER_FIELDS = [
  'business_summary',
  'target_industries',
  'target_services',
  'target_geographies',
  'geographic_footprint',
  'service_regions',
  'hq_state',
  'hq_city',
  'min_revenue',
  'max_revenue',
  'min_ebitda',
  'max_ebitda',
  'pe_firm_name',
  'thesis_summary',
  'data_last_updated',
];

interface Props {
  addLog: AddLogFn;
  buyerId: string;
  onBuyerIdChange: (id: string) => void;
}

export default function BuyerEnrichSection({ addLog, buyerId, onBuyerIdChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState<Record<string, unknown> | null>(null);
  const [after, setAfter] = useState<Record<string, unknown> | null>(null);

  const run = async () => {
    if (!buyerId.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setAfter(null);
    const t0 = Date.now();
    try {
      const { data: bData, error: bDataError } = await supabase
        .from('buyers')
        .select('*')
        .eq('id', buyerId)
        .single();
      if (bDataError) throw bDataError;
      setBefore(bData as Record<string, unknown> | null);

      const { data, error: fnErr } = await supabase.functions.invoke('enrich-buyer', {
        body: { buyerId },
      });
      const dur = Date.now() - t0;

      if (fnErr) {
        setError(String(fnErr));
        addLog(`enrich-buyer for ${buyerId.slice(0, 8)}…`, dur, false);
        return;
      }
      setResponse(data);

      const { data: aData, error: aDataError } = await supabase
        .from('buyers')
        .select('*')
        .eq('id', buyerId)
        .single();
      if (aDataError) throw aDataError;
      setAfter(aData as Record<string, unknown> | null);

      addLog(
        `enrich-buyer for ${buyerId.slice(0, 8)}… (${data?.fieldsExtracted ?? '?'} fields, ${data?.dataCompleteness ?? '?'})`,
        dur,
      );
    } catch (e: unknown) {
      const dur = Date.now() - t0;
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      addLog(`enrich-buyer for ${buyerId.slice(0, 8)}… — ${msg}`, dur, false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Single Buyer Enrichment Test" icon={<FlaskConical className="h-5 w-5" />}>
      <p className="text-xs text-muted-foreground">
        Search for a buyer by PE firm name, or use the shuffle button to pick a random unenriched
        buyer.
      </p>
      <EntityPicker
        entity="buyer"
        value={buyerId}
        onChange={onBuyerIdChange}
        placeholder="Search buyers by name or pick random…"
      />
      <div className="flex gap-2 items-center">
        {buyerId && (
          <span className="text-xs font-mono text-muted-foreground truncate flex-1">
            Selected: {buyerId}
          </span>
        )}
        <div className="ml-auto">
          <Button onClick={run} disabled={loading || !buyerId.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Test Enrich Buyer
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {response && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <StatusBadge ok={response.success} />
            {response.fieldsExtracted !== undefined && (
              <Badge variant="secondary">{response.fieldsExtracted} fields extracted</Badge>
            )}
            {response.dataCompleteness && (
              <Badge variant="outline">{response.dataCompleteness}</Badge>
            )}
            {response.error_code && <Badge variant="destructive">{response.error_code}</Badge>}
          </div>
          <JsonBlock data={response} />
        </div>
      )}

      <ComparisonTable fields={BUYER_FIELDS} before={before} after={after} />
    </SectionCard>
  );
}
