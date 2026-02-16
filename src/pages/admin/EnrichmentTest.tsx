import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  AlertTriangle, ChevronDown, Loader2, Trash2, CheckCircle2, XCircle,
  FlaskConical, Shield, BarChart3, ListChecks, Activity,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
interface LogEntry {
  ts: string;
  msg: string;
  durationMs?: number;
  ok: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────
function ts() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function StatusBadge({ ok }: { ok: boolean | null | undefined }) {
  if (ok === null || ok === undefined) return null;
  return ok ? (
    <Badge className="bg-green-600 text-white">SUCCESS</Badge>
  ) : (
    <Badge variant="destructive">FAILED</Badge>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <ScrollArea className="max-h-64 rounded-md border bg-muted p-3">
      <pre className="text-xs whitespace-pre-wrap break-all font-mono text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </ScrollArea>
  );
}

function ComparisonTable({
  fields,
  before,
  after,
}: {
  fields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) return null;
  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Field</TableHead>
            <TableHead>Before</TableHead>
            <TableHead>After</TableHead>
            <TableHead className="w-[80px]">Changed?</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((f) => {
            const b = before ? String(before[f] ?? "—") : "—";
            const a = after ? String(after[f] ?? "—") : "—";
            const changed = b !== a;
            return (
              <TableRow key={f}>
                <TableCell className="font-mono text-xs">{f}</TableCell>
                <TableCell className="text-xs max-w-[260px] truncate">{b}</TableCell>
                <TableCell className="text-xs max-w-[260px] truncate">{a}</TableCell>
                <TableCell>
                  {changed ? (
                    <Badge className="bg-amber-500 text-white text-[10px]">YES</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              {icon}
              {title}
            </CardTitle>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function EnrichmentTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const addLog = useCallback((msg: string, durationMs?: number, ok = true) => {
    setLogs((p) => [{ ts: ts(), msg, durationMs, ok }, ...p]);
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Enrichment Test Dashboard</h1>
        <Badge variant="outline" className="text-xs">TEMP / DEV ONLY</Badge>
      </div>

      <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">Warning</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          This is a test dashboard. Enrichment calls use real AI credits and real API calls. Use with care.
        </AlertDescription>
      </Alert>

      <DealEnrichSection addLog={addLog} />
      <BuyerEnrichSection addLog={addLog} />
      <ProvenanceSection addLog={addLog} />
      <ScoringSection addLog={addLog} />
      <QueueSection addLog={addLog} />

      {/* Section 6: Log Console */}
      <SectionCard title="Test Log / Console" icon={<Activity className="h-5 w-5" />}>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setLogs([])}>
            <Trash2 className="h-3 w-3 mr-1" /> Clear Log
          </Button>
        </div>
        <ScrollArea className="h-64 rounded-md border bg-muted/50 p-3">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No actions logged yet.</p>
          )}
          {logs.map((l, i) => (
            <p
              key={i}
              className={`font-mono text-xs leading-relaxed ${l.ok ? "text-foreground" : "text-destructive"}`}
            >
              [{l.ts}] {l.msg}
              {l.durationMs !== undefined && ` — ${l.durationMs.toLocaleString()}ms`}
              {l.ok ? " — SUCCESS" : " — ERROR"}
            </p>
          ))}
        </ScrollArea>
      </SectionCard>
    </div>
  );
}

// ─── Section 1: Deal Enrichment ──────────────────────────────────────
function DealEnrichSection({ addLog }: { addLog: (m: string, d?: number, ok?: boolean) => void }) {
  const [dealId, setDealId] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState<Record<string, unknown> | null>(null);
  const [after, setAfter] = useState<Record<string, unknown> | null>(null);

  const DEAL_FIELDS = [
    "executive_summary", "description", "business_model", "revenue", "ebitda",
    "full_time_employees", "address_city", "address_state", "address_zip",
    "website", "linkedin_url", "enriched_at", "deal_total_score",
  ];

  const run = async () => {
    if (!dealId.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setAfter(null);
    const t0 = Date.now();
    try {
      // Fetch before
      const { data: bData } = await supabase.from("listings").select("*").eq("id", dealId).single();
      setBefore(bData as any);

      // Call enrich-deal
      const { data, error: fnErr } = await supabase.functions.invoke("enrich-deal", {
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
      const { data: aData } = await supabase.from("listings").select("*").eq("id", dealId).single();
      setAfter(aData as any);

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

  return (
    <SectionCard title="Single Deal Enrichment Test" icon={<FlaskConical className="h-5 w-5" />}>
      <div className="flex gap-2">
        <Input
          placeholder="Enter Deal / Listing ID"
          value={dealId}
          onChange={(e) => setDealId(e.target.value)}
          className="font-mono text-sm"
        />
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
              <p>Pages attempted: {response.scrapeReport.pagesAttempted ?? "—"}</p>
              <p>Pages successful: {response.scrapeReport.pagesSuccessful ?? "—"}</p>
              <p>Chars scraped: {response.scrapeReport.totalCharsScraped ?? "—"}</p>
            </div>
          )}

          {response.transcriptReport && (
            <div className="text-xs space-y-0.5 text-muted-foreground">
              <p>Total transcripts: {response.transcriptReport.total ?? "—"}</p>
              <p>Processed: {response.transcriptReport.processed ?? "—"}</p>
              <p>Errors: {response.transcriptReport.errors ?? "—"}</p>
            </div>
          )}

          <JsonBlock data={response} />
        </div>
      )}

      <ComparisonTable fields={DEAL_FIELDS} before={before} after={after} />
    </SectionCard>
  );
}

// ─── Section 2: Buyer Enrichment ─────────────────────────────────────
function BuyerEnrichSection({ addLog }: { addLog: (m: string, d?: number, ok?: boolean) => void }) {
  const [buyerId, setBuyerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState<Record<string, unknown> | null>(null);
  const [after, setAfter] = useState<Record<string, unknown> | null>(null);

  const BUYER_FIELDS = [
    "business_summary", "target_industries", "target_services",
    "target_geographies", "geographic_footprint", "service_regions",
    "hq_state", "hq_city", "min_revenue", "max_revenue",
    "min_ebitda", "max_ebitda", "pe_firm_name",
    "thesis_summary", "data_last_updated",
  ];

  const run = async () => {
    if (!buyerId.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setAfter(null);
    const t0 = Date.now();
    try {
      const { data: bData } = await supabase.from("buyers").select("*").eq("id", buyerId).single();
      setBefore(bData as any);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 180_000);

      const { data, error: fnErr } = await supabase.functions.invoke("enrich-buyer", {
        body: { buyerId },
      });
      clearTimeout(timer);
      const dur = Date.now() - t0;

      if (fnErr) {
        setError(String(fnErr));
        addLog(`enrich-buyer for ${buyerId.slice(0, 8)}…`, dur, false);
        return;
      }
      setResponse(data);

      const { data: aData } = await supabase.from("buyers").select("*").eq("id", buyerId).single();
      setAfter(aData as any);

      addLog(
        `enrich-buyer for ${buyerId.slice(0, 8)}… (${data?.fieldsExtracted ?? "?"} fields, ${data?.dataCompleteness ?? "?"})`,
        dur,
      );
    } catch (e: any) {
      const dur = Date.now() - t0;
      setError(e.message);
      addLog(`enrich-buyer for ${buyerId.slice(0, 8)}… — ${e.message}`, dur, false);
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

// ─── Section 3: Provenance ───────────────────────────────────────────
function ProvenanceSection({ addLog }: { addLog: (m: string, d?: number, ok?: boolean) => void }) {
  const [dealId, setDealId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    sources: Record<string, string>;
  } | null>(null);

  const PROV_FIELDS = ["revenue", "ebitda", "executive_summary", "description"];

  const run = async () => {
    if (!dealId.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    const t0 = Date.now();
    try {
      // Fetch before values
      const { data: bData } = await supabase.from("listings").select("*").eq("id", dealId).single();
      if (!bData) throw new Error("Deal not found");

      // Fetch extraction sources
      const { data: srcData } = await supabase
        .from("extraction_sources" as any)
        .select("*")
        .eq("listing_id", dealId);
      const sourceMap: Record<string, string> = {};
      if (Array.isArray(srcData)) {
        srcData.forEach((s: any) => {
          if (s.field_name && s.source_type) sourceMap[s.field_name] = s.source_type;
        });
      }

      // Enrich
      const { error: fnErr } = await supabase.functions.invoke("enrich-deal", {
        body: { dealId },
      });
      const dur = Date.now() - t0;
      if (fnErr) {
        setError(String(fnErr));
        addLog(`provenance test for ${dealId.slice(0, 8)}…`, dur, false);
        return;
      }

      // Fetch after
      const { data: aData } = await supabase.from("listings").select("*").eq("id", dealId).single();

      setResults({
        before: bData as Record<string, unknown>,
        after: (aData ?? {}) as Record<string, unknown>,
        sources: sourceMap,
      });
      addLog(`provenance test for ${dealId.slice(0, 8)}…`, dur);
    } catch (e: any) {
      const dur = Date.now() - t0;
      setError(e.message);
      addLog(`provenance test — ${e.message}`, dur, false);
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
                const src = results.sources[f] ?? "—";
                const bVal = String(results.before[f] ?? "—");
                const aVal = String(results.after[f] ?? "—");
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

// ─── Section 4: Scoring ──────────────────────────────────────────────
function ScoringSection({ addLog }: { addLog: (m: string, d?: number, ok?: boolean) => void }) {
  const [dealId, setDealId] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, unknown> | null>(null);

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
        addLog(`calculate-deal-quality for ${dealId.slice(0, 8)}…`, dur, false);
        return;
      }
      setResponse(data);

      const { data: listing } = await supabase
        .from("listings")
        .select("deal_total_score, deal_size_score")
        .eq("id", dealId)
        .single();
      setScores(listing as any);
      addLog(`calculate-deal-quality for ${dealId.slice(0, 8)}… (score: ${(listing as any)?.deal_total_score ?? "—"})`, dur);
    } catch (e: any) {
      const dur = Date.now() - t0;
      setError(e.message);
      addLog(`scoring — ${e.message}`, dur, false);
    } finally {
      setLoading(false);
    }
  };

  const totalScore = (scores as any)?.deal_total_score ?? 0;

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
            Size Score: {(scores as any)?.deal_size_score ?? "—"}
          </div>
        </div>
      )}

      {response && <JsonBlock data={response} />}
    </SectionCard>
  );
}

// ─── Section 5: Queue ────────────────────────────────────────────────
function QueueSection({ addLog }: { addLog: (m: string, d?: number, ok?: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [queue, setQueue] = useState<any[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: c, error: qErr } = await supabase
        .from("enrichment_queue" as any)
        .select("*", { count: "exact" })
        .order("queued_at", { ascending: false })
        .limit(20);
      if (qErr) throw qErr;
      setQueue(data as any[]);
      setCount(c);
      addLog(`Fetched queue — ${c ?? 0} total items`);
    } catch (e: any) {
      setError(e.message);
      addLog(`Queue fetch — ${e.message}`, undefined, false);
    } finally {
      setLoading(false);
    }
  };

  const triggerWorker = async () => {
    setTriggerLoading(true);
    const t0 = Date.now();
    try {
      const { error: fnErr } = await supabase.functions.invoke("process-enrichment-queue", {
        body: { source: "test_dashboard" },
      });
      const dur = Date.now() - t0;
      if (fnErr) {
        addLog(`process-enrichment-queue — ${fnErr}`, dur, false);
      } else {
        addLog(`process-enrichment-queue triggered`, dur);
      }
    } catch (e: any) {
      addLog(`process-enrichment-queue — ${e.message}`, Date.now() - t0, false);
    } finally {
      setTriggerLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    processing: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    completed: "bg-green-500/15 text-green-700 border-green-500/30",
    failed: "bg-red-500/15 text-red-700 border-red-500/30",
    paused: "bg-gray-500/15 text-gray-600 border-gray-500/30",
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
              {queue.map((item: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{item.listing_id ?? item.id}</TableCell>
                  <TableCell>
                    <Badge className={statusColor[item.status] ?? ""}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>{item.attempts ?? 0}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate text-destructive">
                    {item.last_error ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{item.queued_at ? new Date(item.queued_at).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
