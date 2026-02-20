import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  XCircle,
  FolderPlus,
  Star,
  Download,
  Archive,
  Trash2,
  Globe,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { exportDealsToCSV } from "@/lib/exportUtils";
import type { DealListing } from "../types";

interface DealsBulkActionsProps {
  selectedDeals: Set<string>;
  localOrder: DealListing[];
  onClearSelection: () => void;
  onShowUniverseDialog: () => void;
  onShowArchiveDialog: () => void;
  onShowDeleteDialog: () => void;
  setSelectedDeals: (deals: Set<string>) => void;
  refetchListings: () => void;
  toast: (opts: any) => void;
}

export const DealsBulkActions = ({
  selectedDeals,
  localOrder,
  onClearSelection,
  onShowUniverseDialog,
  onShowArchiveDialog,
  onShowDeleteDialog,
  setSelectedDeals,
  refetchListings,
  toast,
}: DealsBulkActionsProps) => {
  if (selectedDeals.size === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm font-medium">
            {selectedDeals.size} selected
          </Badge>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <XCircle className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onShowUniverseDialog}
          >
            <FolderPlus className="h-4 w-4 mr-1" />
            Send to Universe
          </Button>
          {(() => {
            const dealIds = Array.from(selectedDeals);
            const allPriority = dealIds.length > 0 && dealIds.every(id => localOrder?.find(d => d.id === id)?.is_priority_target);
            return (
              <Button
                size="sm"
                variant="outline"
                className={cn("gap-2", allPriority ? "text-muted-foreground" : "text-amber-600 border-amber-200 hover:bg-amber-50")}
                onClick={async () => {
                  const newValue = !allPriority;
                  const { error } = await supabase
                    .from('listings')
                    .update({ is_priority_target: newValue } as never)
                    .in('id', dealIds);
                  if (error) {
                    toast({ title: 'Error', description: 'Failed to update priority', variant: 'destructive' });
                  } else {
                    toast({ title: newValue ? 'Priority Set' : 'Priority Removed', description: `${dealIds.length} deal(s) updated` });
                    setSelectedDeals(new Set());
                    refetchListings();
                  }
                }}
              >
                <Star className={cn("h-4 w-4", allPriority ? "" : "fill-amber-500")} />
                {allPriority ? "Remove Priority" : "Mark as Priority"}
              </Button>
            );
          })()}

          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ids = Array.from(selectedDeals);
              const result = await exportDealsToCSV(ids);
              if (result.success) {
                toast({ title: "Exported", description: `${result.count} deal(s) exported to CSV` });
              } else {
                toast({ title: "Export failed", description: result.error, variant: "destructive" });
              }
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>

          <div className="h-5 w-px bg-border" />

          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-200 hover:bg-green-50"
            onClick={async () => {
              const ids = Array.from(selectedDeals);
              const { error } = await supabase
                .from('listings')
                .update({ is_internal_deal: false } as never)
                .in('id', ids);
              if (error) {
                toast({ title: 'Error', description: 'Failed to list on marketplace', variant: 'destructive' });
              } else {
                toast({ title: 'Listed on Marketplace', description: `${ids.length} deal(s) listed` });
                setSelectedDeals(new Set());
                refetchListings();
              }
            }}
          >
            <Globe className="h-4 w-4 mr-1" />
            List on Marketplace
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ids = Array.from(selectedDeals);
              const { error } = await supabase
                .from('listings')
                .update({ is_internal_deal: true } as never)
                .in('id', ids);
              if (error) {
                toast({ title: 'Error', description: 'Failed to unlist from marketplace', variant: 'destructive' });
              } else {
                toast({ title: 'Unlisted from Marketplace', description: `${ids.length} deal(s) unlisted` });
                setSelectedDeals(new Set());
                refetchListings();
              }
            }}
          >
            <EyeOff className="h-4 w-4 mr-1" />
            Unlist
          </Button>

          <div className="h-5 w-px bg-border" />

          <Button
            size="sm"
            variant="outline"
            onClick={onShowArchiveDialog}
          >
            <Archive className="h-4 w-4 mr-1" />
            Archive Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={onShowDeleteDialog}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Selected
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
