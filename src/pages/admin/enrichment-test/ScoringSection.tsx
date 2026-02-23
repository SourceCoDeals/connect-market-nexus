import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Loader2, BarChart3 } from "lucide-react";
import { JsonBlock, SectionCard } from "./shared";
import type { AddLogFn } from "./shared";

export default function ScoringSection({ addLog }: { addLog: AddLogFn }) {
  const [dealId, setDealId] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<{ deal_total_score: number | null; deal_size_score: number | null } | null>(null);

  const run = async () => {
    if (!dealId.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setScores(null);
    const t0 = Date.now();
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("calculate-deal-quality", {
        body: { listingId: dealId },
      });
      const dur = Date.now() - t0;
      if (fnErr) {
        setError(String(fnErr));
        addLog(`calculate-deal-quality for ${dealId.slice(0, 8)}\u2026`, dur, false);
        return;
      }
      setResponse(data);

      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .select("deal_total_score, deal_size_score")
        .eq("id", dealId)
        .single();
      if (listingError) throw listingError;
      setScores(listing);
      addLog(`calculate-deal-quality for ${dealId.slice(0, 8)}\u2026 (score: ${listing?.deal_total_score ?? "\u2014"})`, dur);
    } catch (e: any) {
      const dur = Date.now() - t0;
      setError(e.message);
      addLog(`scoring \u2014 ${e.message}`, dur, false);
    } finally {
      setLoading(false);
    }
  };

  const totalScore = scores?.deal_total_score ?? 0;

  return (
    <SectionCard title="Scoring Verification" icon={<BarChart3 className="h-5 w-5" />}>
      <div className="flex gap-2">
        <Input
          placeholder="Enter Deal ID"
          value={dealId}
          onChange={(e) => setDealId(e.target.value)}
          className="font-mono text-sm"
        />
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
            Size Score: {scores?.deal_size_score ?? "\u2014"}
          </div>
        </div>
      )}

      {response && <JsonBlock data={response} />}
    </SectionCard>
  );
}
