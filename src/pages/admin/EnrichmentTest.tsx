import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Trash2, Activity } from "lucide-react";

import { ts, SectionCard } from "./enrichment-test/shared";
import type { LogEntry } from "./enrichment-test/shared";
import DealEnrichSection from "./enrichment-test/DealEnrichSection";
import BuyerEnrichSection from "./enrichment-test/BuyerEnrichSection";
import ProvenanceSection from "./enrichment-test/ProvenanceSection";
import ScoringSection from "./enrichment-test/ScoringSection";
import QueueSection from "./enrichment-test/QueueSection";

// ─── Main Component ──────────────────────────────────────────────────
export default function EnrichmentTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // N09 FIX: Gate behind confirmation to prevent accidental usage of production AI credits
  const [confirmed, setConfirmed] = useState(false);
  const addLog = useCallback((msg: string, durationMs?: number, ok = true) => {
    setLogs((p) => [{ ts: ts(), msg, durationMs, ok }, ...p]);
  }, []);

  if (!confirmed) {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">Enrichment Test Dashboard</h1>
        <Alert className="border-red-500/50 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800 dark:text-red-300">Production Warning</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-400">
            This dashboard calls <strong>real AI APIs</strong> (Gemini, Firecrawl, etc.) and can <strong>modify production data</strong>.
            Each enrichment or scoring test consumes API credits.
          </AlertDescription>
        </Alert>
        <Button variant="destructive" onClick={() => setConfirmed(true)}>
          I understand — open test dashboard
        </Button>
      </div>
    );
  }

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
          {logs.map((l) => (
            <p
              key={l.ts}
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
