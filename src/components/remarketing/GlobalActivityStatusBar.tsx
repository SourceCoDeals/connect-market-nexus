import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, Pause, Play, X, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useGlobalActivityQueue,
  useGlobalActivityMutations,
} from "@/hooks/remarketing/useGlobalActivityQueue";
import { OPERATION_TYPE_LABELS } from "@/types/remarketing";
import type { GlobalActivityQueueItem } from "@/types/remarketing";
import { cn } from "@/lib/utils";

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function estimateETA(item: GlobalActivityQueueItem): string | null {
  if (!item.started_at || item.completed_items === 0) return null;
  const elapsed = Date.now() - new Date(item.started_at).getTime();
  const rate = item.completed_items / (elapsed / 1000); // items/sec
  const remaining = item.total_items - item.completed_items - item.failed_items;
  if (rate <= 0 || remaining <= 0) return null;
  const secsLeft = remaining / rate;
  if (secsLeft < 60) return "< 1 min";
  const minsLeft = Math.ceil(secsLeft / 60);
  return `~${minsLeft} min`;
}

function OperationRow({ item, showControls }: { item: GlobalActivityQueueItem; showControls?: boolean }) {
  const { pauseOperation, resumeOperation, cancelOperation } = useGlobalActivityMutations();
  const pct = item.total_items > 0
    ? Math.round(((item.completed_items + item.failed_items) / item.total_items) * 100)
    : 0;
  const label = OPERATION_TYPE_LABELS[item.operation_type] || item.operation_type;
  const userName = (item.profiles as any)?.full_name || "Unknown";
  const eta = estimateETA(item);

  return (
    <div className="flex items-center gap-3 min-w-0">
      {/* Status icon */}
      {item.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />}
      {item.status === "paused" && <Pause className="h-4 w-4 text-amber-400 shrink-0" />}
      {item.status === "queued" && <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
      {item.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
      {item.status === "failed" && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
      {item.status === "cancelled" && <X className="h-4 w-4 text-muted-foreground shrink-0" />}

      {/* Description */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate">
            {item.description || label}
          </span>
          {item.status === "running" && (
            <span className="text-muted-foreground text-xs shrink-0">
              {item.completed_items}/{item.total_items}
              {eta && ` — ${eta}`}
            </span>
          )}
          {item.status === "queued" && (
            <Badge variant="outline" className="text-[10px] h-4 shrink-0">Queued</Badge>
          )}
        </div>
        {item.status === "running" && item.total_items > 0 && (
          <Progress value={pct} className="h-1.5 mt-1" />
        )}
      </div>

      {/* Meta */}
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
        {userName} {item.started_at ? formatTimeAgo(item.started_at) : formatTimeAgo(item.queued_at)}
      </span>

      {/* Failed count */}
      {item.failed_items > 0 && (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="destructive" className="text-[10px] h-5 shrink-0">
              {item.failed_items} failed
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {item.failed_items} items failed — view details in Activity Queue
          </TooltipContent>
        </Tooltip>
      )}

      {/* Controls */}
      {showControls && (item.status === "running" || item.status === "paused") && (
        <div className="flex items-center gap-1 shrink-0">
          {item.status === "running" ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => pauseOperation.mutate(item.id)}
              disabled={pauseOperation.isPending}
            >
              <Pause className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => resumeOperation.mutate(item.id)}
              disabled={resumeOperation.isPending}
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => cancelOperation.mutate(item.id)}
            disabled={cancelOperation.isPending}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function GlobalActivityStatusBar() {
  const { runningOp, pausedOp, queuedOps, isLoading } = useGlobalActivityQueue();
  const [expanded, setExpanded] = useState(false);

  const activeOp = runningOp || pausedOp;
  const hasActivity = !!activeOp || queuedOps.length > 0;

  if (isLoading || !hasActivity) return null;

  return (
    <div className="border-b border-border bg-card/80 backdrop-blur-sm">
      {/* Main bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Activity className="h-4 w-4 text-blue-400 shrink-0" />

        {activeOp ? (
          <div className="flex-1 min-w-0">
            <OperationRow item={activeOp} showControls />
          </div>
        ) : queuedOps.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {queuedOps.length} operation{queuedOps.length > 1 ? "s" : ""} queued
          </span>
        ) : null}

        {/* Queue badge + expand toggle */}
        <div className="flex items-center gap-1 shrink-0">
          {queuedOps.length > 0 && activeOp && (
            <Badge variant="secondary" className="text-[10px] h-5">
              +{queuedOps.length} queued
            </Badge>
          )}
          <Link to="/admin/remarketing/activity-queue">
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2">
              View All
            </Button>
          </Link>
          {queuedOps.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded queue list */}
      {expanded && queuedOps.length > 0 && (
        <div className="border-t border-border/50 px-4 py-2 space-y-2">
          {queuedOps.map((op) => (
            <OperationRow key={op.id} item={op} showControls />
          ))}
        </div>
      )}
    </div>
  );
}
