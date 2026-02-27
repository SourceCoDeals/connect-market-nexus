import { useState, useEffect, MutableRefObject } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FlaskConical } from 'lucide-react';
import { StatusBadge, JsonBlock, ComparisonTable, SectionCard } from './shared';
import type { AddLogFn } from './shared';

const DEAL_FIELDS = [
  'executive_summary',
  'description',
  'revenue',
  'ebitda',
  'full_time_employees',
  'address_city',
  'address_state',
  'address_zip',
  'website',
  'linkedin_url',
  'enriched_at',
  'deal_total_score',
];

interface Props {
  addLog: AddLogFn;
  dealId: string;
  runRef?: MutableRefObject<(() => Promise<void>) | undefined>;
}

export default function DealEnrichSection({ addLog, dealId, runRef }: Props) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState<Record<string, unknown> | null>(null);
  const [after, setAfter] = useState<Record<string, unknown> | null>(null);

  const run = async () => {
    if (!dealId.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setAfter(null);
    const t0 = Date.now();
    try {
      // Fetch before
      const { data: bData, error: bDataError } = await supabase
        .from('listings')
        .select(
          'id, executive_summary, description, revenue, ebitda, full_time_employees, address_city, address_state, address_zip, website, linkedin_url, enriched_at, deal_total_score',
        )
        .eq('id', dealId)
        .single();
      if (bDataError) throw bDataError;
      setBefore(bData as Record<string, unknown> | null);

      // Call enrich-deal
      const { data, error: fnErr } = await supabase.functions.invoke('enrich-deal', {
        body: { dealId },
      });
      const dur = Date.now() - t0;

      if (fnErr) {
        setError(String(fnErr));
        addLog(`enrich-deal for ${dealId.slice(0, 8)}…`, dur, false);
        return;
      }
      setResponse(data);

      // Fetch after
      const { data: aData, error: aDataError } = await supabase
        .from('listings')
        .select(
          'id, executive_summary, description, revenue, ebitda, full_time_employees, address_city, address_state, address_zip, website, linkedin_url, enriched_at, deal_total_score',
        )
        .eq('id', dealId)
        .single();
      if (aDataError) throw aDataError;
      setAfter(aData as Record<string, unknown> | null);

      const fieldsUpdated = data?.fieldsUpdated?.length ?? 0;
      addLog(`enrich-deal for ${dealId.slice(0, 8)}… (${fieldsUpdated} fields updated)`, dur);
    } catch (e: any) {
      const dur = Date.now() - t0;
      setError(e.message);
      addLog(`enrich-deal for ${dealId.slice(0, 8)}… — ${e.message}`, dur, false);
    } finally {
      setLoading(false);
    }
  };

  // Expose run function to parent for "Run All" feature
  useEffect(() => {
    if (runRef) runRef.current = run;
  });

  return (
    <SectionCard title="Single Deal Enrichment Test" icon={<FlaskConical className="h-5 w-5" />}>
      <div className="flex gap-2 items-center">
        {dealId ? (
          <span className="text-sm font-mono text-muted-foreground truncate flex-1">
            Deal: {dealId.slice(0, 12)}…
          </span>
        ) : (
          <span className="text-sm text-muted-foreground italic flex-1">
            Select a deal above to begin
          </span>
        )}
        <Button onClick={run} disabled={loading || !dealId.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Test Enrich Deal
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {response && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <StatusBadge ok={response.success} />
            {response.fieldsUpdated && (
              <Badge variant="secondary">{response.fieldsUpdated.length} fields updated</Badge>
            )}
            {response.error_code && <Badge variant="destructive">{response.error_code}</Badge>}
          </div>

          {response.scrapeReport && (
            <div className="text-xs space-y-0.5 text-muted-foreground">
              <p>Pages attempted: {response.scrapeReport.pagesAttempted ?? '—'}</p>
              <p>Pages successful: {response.scrapeReport.pagesSuccessful ?? '—'}</p>
              <p>Chars scraped: {response.scrapeReport.totalCharsScraped ?? '—'}</p>
            </div>
          )}

          {response.transcriptReport && (
            <div className="text-xs space-y-0.5 text-muted-foreground">
              <p>Total transcripts: {response.transcriptReport.total ?? '—'}</p>
              <p>Processed: {response.transcriptReport.processed ?? '—'}</p>
              <p>Errors: {response.transcriptReport.errors ?? '—'}</p>
            </div>
          )}

          <JsonBlock data={response} />
        </div>
      )}

      <ComparisonTable fields={DEAL_FIELDS} before={before} after={after} />
    </SectionCard>
  );
}
