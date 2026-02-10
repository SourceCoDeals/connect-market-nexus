import { useState } from "react";
import { Activity, CheckCircle2, XCircle, Clock, Loader2, Pause, Play, X, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  useGlobalActivityQueue,
  useGlobalActivityMutations,
} from "@/hooks/remarketing/useGlobalActivityQueue";
import { OPERATION_TYPE_LABELS } from "@/types/remarketing";
import type { GlobalActivityQueueItem, GlobalActivityErrorEntry } from "@/types/remarketing";

function formatDuration(startStr: string, endStr?: string | null): string {
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const secs = Math.floor((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function estimateETA(item: GlobalActivityQueueItem): string | null {
  if (!item.started_at || item.completed_items === 0) return null;
  const elapsed = Date.now() - new Date(item.started_at).getTime();
  const rate = item.completed_items / (elapsed / 1000);
  const remaining = item.total_items - item.completed_items - item.failed_items;
  if (rate <= 0 || remaining <= 0) return null;
  const secsLeft = remaining / rate;
  const minsLeft = Math.ceil(secsLeft / 60);
  return minsLeft < 1 ? "< 1 min" : `~${minsLeft} min`;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    running: { variant: "default", label: "Running" },
    queued: { variant: "outline", label: "Queued" },
    paused: { variant: "secondary", label: "Paused" },
    completed: { variant: "default", label: "Completed" },
    failed: { variant: "destructive", label: "Failed" },
    cancelled: { variant: "secondary", label: "Cancelled" },
  };
  const v = variants[status] || { variant: "outline" as const, label: status };
  return (
    <Badge variant={v.variant} className={status === "completed" ? "bg-emerald-600" : undefined}>
      {v.label}
    </Badge>
  );
}

function CurrentOperationCard({ item }: { item: GlobalActivityQueueItem }) {
  const { pauseOperation, resumeOperation, cancelOperation } = useGlobalActivityMutations();
  const pct = item.total_items > 0
    ? Math.round(((item.completed_items + item.failed_items) / item.total_items) * 100)
    : 0;
  const label = OPERATION_TYPE_LABELS[item.operation_type] || item.operation_type;
  const userName = (item.profiles as any)?.full_name || "Unknown";
  const eta = estimateETA(item);
  const rate = item.started_at && item.completed_items > 0
    ? (item.completed_items / ((Date.now() - new Date(item.started_at).getTime()) / 60000)).toFixed(1)
    : null;

  return (
    <Card className="border-blue-500/30 bg-blue-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className={`h-5 w-5 ${item.status === "running" ? "animate-spin text-blue-400" : "text-amber-400"}`} />
            <CardTitle className="text-lg">{item.description || label}</CardTitle>
            <StatusBadge status={item.status} />
          </div>
          <div className="flex items-center gap-1">
            {item.status === "running" ? (
              <Button variant="outline" size="sm" onClick={() => pauseOperation.mutate(item.id)} disabled={pauseOperation.isPending}>
                <Pause className="h-3 w-3 mr-1" /> Pause
              </Button>
            ) : item.status === "paused" ? (
              <Button variant="outline" size="sm" onClick={() => resumeOperation.mutate(item.id)} disabled={resumeOperation.isPending}>
                <Play className="h-3 w-3 mr-1" /> Resume
              </Button>
            ) : null}
            <Button variant="destructive" size="sm" onClick={() => cancelOperation.mutate(item.id)} disabled={cancelOperation.isPending}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>{item.completed_items} of {item.total_items} completed</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block">Started by</span>
            <span className="font-medium">{userName}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Duration</span>
            <span className="font-medium">{item.started_at ? formatDuration(item.started_at) : "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Rate</span>
            <span className="font-medium">{rate ? `${rate} items/min` : "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">ETA</span>
            <span className="font-medium">{eta || "—"}</span>
          </div>
        </div>

        {/* Failures */}
        {item.failed_items > 0 && (
          <ErrorLogSection errorLog={item.error_log} failedCount={item.failed_items} />
        )}
      </CardContent>
    </Card>
  );
}

function ErrorLogSection({ errorLog, failedCount }: { errorLog: GlobalActivityErrorEntry[]; failedCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive gap-1 px-2 h-7">
          <AlertTriangle className="h-3 w-3" />
          {failedCount} failed items
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
          {errorLog.map((entry, i) => (
            <div key={i} className="text-xs bg-destructive/10 text-destructive rounded px-2 py-1 font-mono">
              <span className="text-muted-foreground">{entry.itemId}: </span>
              {entry.error}
            </div>
          ))}
          {errorLog.length === 0 && (
            <p className="text-xs text-muted-foreground">Error details not available</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function HistoryRow({ item }: { item: GlobalActivityQueueItem }) {
  const label = OPERATION_TYPE_LABELS[item.operation_type] || item.operation_type;
  const userName = (item.profiles as any)?.full_name || "Unknown";
  const [open, setOpen] = useState(false);
  const hasErrors = item.failed_items > 0 && Array.isArray(item.error_log) && item.error_log.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50">
        {item.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
        {item.status === "failed" && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
        {item.status === "cancelled" && <X className="h-4 w-4 text-muted-foreground shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{item.description || label}</span>
            <StatusBadge status={item.status} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{userName}</span>
            <span>&middot;</span>
            <span>{item.started_at ? formatTime(item.started_at) : formatTime(item.queued_at)}</span>
            {item.started_at && item.completed_at && (
              <>
                <span>&middot;</span>
                <span>{formatDuration(item.started_at, item.completed_at)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-emerald-500">{item.completed_items}</span>
          {item.failed_items > 0 && (
            <span className="text-sm text-red-500">/ {item.failed_items} failed</span>
          )}
          <span className="text-sm text-muted-foreground">of {item.total_items}</span>
          {hasErrors && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
      </div>
      {hasErrors && (
        <CollapsibleContent>
          <div className="ml-7 mb-2 space-y-1">
            {item.error_log.map((entry, i) => (
              <div key={i} className="text-xs bg-destructive/10 text-destructive rounded px-2 py-1 font-mono">
                <span className="text-muted-foreground">{entry.itemId}: </span>
                {entry.error}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

export default function ReMarketingActivityQueue() {
  const { runningOp, pausedOp, queuedOps, recentHistory, isLoading } = useGlobalActivityQueue();
  const { cancelOperation } = useGlobalActivityMutations();
  const [historyFilter, setHistoryFilter] = useState<"all" | "today" | "week">("all");

  const activeOp = runningOp || pausedOp;

  const filteredHistory = recentHistory.filter((item) => {
    if (historyFilter === "all") return true;
    const completedAt = item.completed_at ? new Date(item.completed_at) : null;
    if (!completedAt) return false;
    const now = Date.now();
    if (historyFilter === "today") return now - completedAt.getTime() < 86400000;
    if (historyFilter === "week") return now - completedAt.getTime() < 604800000;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-bold">Activity Queue</h1>
        {activeOp && (
          <Badge variant="default" className="bg-blue-600">
            {activeOp.status === "running" ? "Operation Running" : "Operation Paused"}
          </Badge>
        )}
      </div>

      {/* Currently Running */}
      {activeOp ? (
        <CurrentOperationCard item={activeOp} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No operations currently running</p>
          </CardContent>
        </Card>
      )}

      {/* Queued Operations */}
      {queuedOps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Queued Operations
              <Badge variant="secondary">{queuedOps.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queuedOps.map((op, i) => {
              const label = OPERATION_TYPE_LABELS[op.operation_type] || op.operation_type;
              const userName = (op.profiles as any)?.full_name || "Unknown";
              return (
                <div key={op.id} className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/30">
                  <span className="text-sm font-mono text-muted-foreground w-6">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{op.description || label}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {op.total_items} items &middot; {userName} &middot; {formatTime(op.queued_at)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-7"
                    onClick={() => cancelOperation.mutate(op.id)}
                  >
                    Cancel
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent History</CardTitle>
            <Select value={historyFilter} onValueChange={(v: any) => setHistoryFilter(v)}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent operations</p>
          ) : (
            <div className="divide-y divide-border">
              {filteredHistory.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
