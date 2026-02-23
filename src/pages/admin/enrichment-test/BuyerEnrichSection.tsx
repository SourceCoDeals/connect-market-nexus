import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, FlaskConical } from "lucide-react";
import { StatusBadge, JsonBlock, ComparisonTable, SectionCard } from "./shared";
import type { AddLogFn } from "./shared";

const BUYER_FIELDS = [
  "business_summary", "target_industries", "target_services",
  "target_geographies", "geographic_footprint", "service_regions",
  "hq_state", "hq_city", "min_revenue", "max_revenue",
  "min_ebitda", "max_ebitda", "pe_firm_name",
  "thesis_summary", "data_last_updated",
];

export default function BuyerEnrichSection({ addLog }: { addLog: AddLogFn }) {
  const [buyerId, setBuyerId] = useState("");
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
      const { data: bData, error: bDataError } = await supabase.from("buyers").select("*").eq("id", buyerId).single();
      if (bDataError) throw bDataError;
      setBefore(bData as Record<string, unknown> | null);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 180_000);

      const { data, error: fnErr } = await supabase.functions.invoke("enrich-buyer", {
        body: { buyerId },
      });
      clearTimeout(timer);
      const dur = Date.now() - t0;

      if (fnErr) {
        setError(String(fnErr));
        addLog(`enrich-buyer for ${buyerId.slice(0, 8)}\u2026`, dur, false);
        return;
      }
      setResponse(data);

      const { data: aData, error: aDataError } = await supabase.from("buyers").select("*").eq("id", buyerId).single();
      if (aDataError) throw aDataError;
      setAfter(aData as Record<string, unknown> | null);

      addLog(
        `enrich-buyer for ${buyerId.slice(0, 8)}\u2026 (${data?.fieldsExtracted ?? "?"} fields, ${data?.dataCompleteness ?? "?"})`,
        dur,
      );
    } catch (e: any) {
      const dur = Date.now() - t0;
      setError(e.message);
      addLog(`enrich-buyer for ${buyerId.slice(0, 8)}\u2026 \u2014 ${e.message}`, dur, false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Single Buyer Enrichment Test" icon={<FlaskConical className="h-5 w-5" />}>
      <div className="flex gap-2">
        <Input
          placeholder="Enter Buyer ID"
          value={buyerId}
          onChange={(e) => setBuyerId(e.target.value)}
          className="font-mono text-sm"
        />
        <Button onClick={run} disabled={loading || !buyerId.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Test Enrich Buyer
        </Button>
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
