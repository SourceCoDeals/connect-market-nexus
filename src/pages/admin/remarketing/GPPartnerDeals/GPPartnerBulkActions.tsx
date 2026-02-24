import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { exportDealsToCSV } from "@/lib/exportUtils";
import {
  CheckCircle2, Sparkles, Loader2, Star, XCircle, Download, Phone, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GPPartnerDeal } from "./types";

interface GPPartnerBulkActionsProps {
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  filteredDeals: GPPartnerDeal[];
  isPushing: boolean;
  isEnriching: boolean;
  handlePushToAllDeals: (dealIds: string[]) => Promise<void>;
  handleEnrichSelected: (dealIds: string[]) => Promise<void>;
  onPushToDialer?: () => void;
  onAddToList?: () => void;
}

export function GPPartnerBulkActions({
  selectedIds,
  setSelectedIds,
  filteredDeals,
  isPushing,
  isEnriching,
  handlePushToAllDeals,
  handleEnrichSelected,
  onPushToDialer,
  onAddToList,
}: GPPartnerBulkActionsProps) {
  const queryClient = useQueryClient();

  if (selectedIds.size === 0) return null;

  const dealIds = Array.from(selectedIds);
  const allPriority = dealIds.length > 0 && dealIds.every(id => filteredDeals?.find(d => d.id === id)?.is_priority_target);

  return (
    <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
      <Badge variant="secondary" className="text-sm font-medium">
        {selectedIds.size} selected
      </Badge>
      <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
        <XCircle className="h-4 w-4 mr-1" />
        Clear
      </Button>

      <div className="h-5 w-px bg-border" />

      <Button
        size="sm"
        onClick={() => handlePushToAllDeals(dealIds)}
        disabled={isPushing}
        className="gap-2"
      >
        {isPushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Approve to Active Deals
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleEnrichSelected(dealIds)}
        disabled={isEnriching}
        className="gap-2"
      >
        {isEnriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Enrich Selected
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={cn("gap-2", allPriority ? "text-muted-foreground" : "text-amber-600 border-amber-200 hover:bg-amber-50")}
        onClick={async () => {
          const newValue = !allPriority;
          const { error } = await supabase
            .from("listings")
            .update({ is_priority_target: newValue } as never)
            .in("id", dealIds);
          if (error) {
            sonnerToast.error("Failed to update priority");
          } else {
            sonnerToast.success(newValue ? `${dealIds.length} deal(s) marked as priority` : `${dealIds.length} deal(s) priority removed`);
            setSelectedIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["remarketing", "gp-partner-deals"] });
          }
        }}
      >
        <Star className={cn("h-4 w-4", allPriority ? "" : "fill-amber-500")} />
        {allPriority ? "Remove Priority" : "Mark as Priority"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        onClick={async () => {
          const ids = Array.from(selectedIds);
          const result = await exportDealsToCSV(ids);
          if (result.success) {
            sonnerToast.success(`${result.count} deal(s) exported to CSV`);
          } else {
            sonnerToast.error(result.error || "Export failed");
          }
        }}
      >
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
      {onPushToDialer && (
        <Button size="sm" variant="outline" onClick={onPushToDialer} className="gap-2">
          <Phone className="h-4 w-4" />
          Push to Dialer
        </Button>
      )}
      {onAddToList && (
        <Button size="sm" variant="outline" onClick={onAddToList} className="gap-2">
          <ListChecks className="h-4 w-4" />
          Add to List
        </Button>
      )}
    </div>
  );
}
