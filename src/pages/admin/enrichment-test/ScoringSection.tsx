import { useState, useEffect, MutableRefObject } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, BarChart3 } from 'lucide-react';
import { JsonBlock, SectionCard } from './shared';
import type { AddLogFn } from './shared';

interface Props {
  addLog: AddLogFn;
  dealId: string;
  runRef?: MutableRefObject<(() => Promise<void>) | undefined>;
}

export default function ScoringSection({ addLog, dealId, runRef }: Props) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<{
    deal_total_score: number | null;
    deal_size_score: number | null;
  } | null>(null);

  const run = async () => {
    if (!dealId.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setScores(null);
    const t0 = Date.now();
    try {
      const { queueDealQualityScoring } = await import("@/lib/remarketing/queueScoring");
      const result = await queueDealQualityScoring({ listingIds: [dealId] });
      const dur = Date.now() - t0;
      if (result.errors > 0) {
        setError("Scoring failed");
        addLog(`calculate-deal-quality for ${dealId.slice(0, 8)}…`, dur, false);
        return;
      }
      setResponse(result);

      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('deal_total_score, deal_size_score')
        .eq('id', dealId)
        .single();
      if (listingError) throw listingError;
      setScores(listing);
      addLog(
        `calculate-deal-quality for ${dealId.slice(0, 8)}… (score: ${listing?.deal_total_score ?? '—'})`,
        dur,
      );
    } catch (e: any) {
      const dur = Date.now() - t0;
      setError(e.message);
      addLog(`scoring — ${e.message}`, dur, false);
    } finally {
      setLoading(false);
    }
  };

  // Expose run function to parent for "Run All" feature
  useEffect(() => {
    if (runRef) runRef.current = run;
  });

  const totalScore = scores?.deal_total_score ?? 0;

  return (
    <SectionCard title="Scoring Verification" icon={<BarChart3 className="h-5 w-5" />}>
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
          Test Scoring
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {scores && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Total Score:</span>
            <span className="text-lg font-bold">{totalScore}</span>
          </div>
          <Progress value={Number(totalScore)} className="h-3" />
          <div className="text-xs text-muted-foreground">
            Size Score: {scores?.deal_size_score ?? '—'}
          </div>
        </div>
      )}

      {response && <JsonBlock data={response} />}
    </SectionCard>
  );
}
