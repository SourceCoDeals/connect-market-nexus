import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Loader2, Shield, CheckCircle2, XCircle } from "lucide-react";
import { SectionCard } from "./shared";
import type { AddLogFn } from "./shared";

const PROV_FIELDS = ["revenue", "ebitda", "executive_summary", "description"];

export default function ProvenanceSection({ addLog }: { addLog: AddLogFn }) {
  const [dealId, setDealId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    sources: Record<string, string>;
  } | null>(null);

  const run = async () => {
    if (!dealId.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    const t0 = Date.now();
    try {
      // Fetch before values
      const { data: bData, error: bDataError } = await supabase.from("listings").select("*").eq("id", dealId).single();
      if (bDataError) throw bDataError;
      if (!bData) throw new Error("Deal not found");

      // Fetch extraction sources
      // extraction_sources table is not in generated Supabase types;
      // use type assertion on the untyped table name
      const { data: srcData, error: srcDataError } = await (supabase
        .from("extraction_sources" as any) as any)
        .select("*")
        .eq("listing_id", dealId);
      if (srcDataError) throw srcDataError;
      const sourceMap: Record<string, string> = {};
      if (Array.isArray(srcData)) {
        (srcData as Array<Record<string, unknown>>).forEach((s) => {
          if (s.field_name && s.source_type) sourceMap[String(s.field_name)] = String(s.source_type);
        });
      }

      // Enrich
      const { error: fnErr } = await supabase.functions.invoke("enrich-deal", {
        body: { dealId },
      });
      const dur = Date.now() - t0;
      if (fnErr) {
        setError(String(fnErr));
        addLog(`provenance test for ${dealId.slice(0, 8)}\u2026`, dur, false);
        return;
      }

      // Fetch after
      const { data: aData, error: aDataError } = await supabase.from("listings").select("*").eq("id", dealId).single();
      if (aDataError) throw aDataError;

      setResults({
        before: bData as Record<string, unknown>,
        after: (aData ?? {}) as Record<string, unknown>,
        sources: sourceMap,
      });
      addLog(`provenance test for ${dealId.slice(0, 8)}\u2026`, dur);
    } catch (e: any) {
      const dur = Date.now() - t0;
      setError(e.message);
      addLog(`provenance test \u2014 ${e.message}`, dur, false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Provenance Verification Test" icon={<Shield className="h-5 w-5" />}>
      <p className="text-xs text-muted-foreground">
        Tests that transcript-sourced fields are NOT overwritten by website enrichment.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Deal ID with transcript data"
          value={dealId}
          onChange={(e) => setDealId(e.target.value)}
          className="font-mono text-sm"
        />
        <Button onClick={run} disabled={loading || !dealId.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Test Provenance
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {results && (
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Source Before</TableHead>
                <TableHead>Value Before</TableHead>
                <TableHead>Value After</TableHead>
                <TableHead className="w-[100px]">Protected?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PROV_FIELDS.map((f) => {
                const src = results.sources[f] ?? "\u2014";
                const bVal = String(results.before[f] ?? "\u2014");
                const aVal = String(results.after[f] ?? "\u2014");
                const isTranscript = src === "transcript";
                const changed = bVal !== aVal;
                const protectedOk = isTranscript && !changed;
                const protectedFail = isTranscript && changed;
                return (
                  <TableRow key={f}>
                    <TableCell className="font-mono text-xs">{f}</TableCell>
                    <TableCell>
                      <Badge variant={isTranscript ? "default" : "outline"} className="text-[10px]">
                        {src}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{bVal}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{aVal}</TableCell>
                    <TableCell>
                      {protectedOk && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {protectedFail && <XCircle className="h-4 w-4 text-destructive" />}
                      {!isTranscript && <span className="text-muted-foreground text-xs">n/a</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
