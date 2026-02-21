import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Loader2, Users, FileText, ArrowUpDown, Archive, ArchiveRestore, MoreHorizontal, Trash2 } from "lucide-react";
import { IntelligenceCoverageBar } from "@/components/ma-intelligence/IntelligenceBadge";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteTrackerWithRelated } from "@/lib/ma-intelligence/cascadeDelete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TrackerWithStats {
  id: string;
  industry_name: string;
  archived: boolean;
  updated_at: string;
  buyer_count: number;
  deal_count: number;
  enriched_count: number;    // Buyers with website enrichment (contributes up to 50%)
  transcript_count: number;  // Buyers with transcripts (contributes up to 50%)
}

export default function MATrackers() {
  const [trackers, setTrackers] = useState<TrackerWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackerToDelete, setTrackerToDelete] = useState<TrackerWithStats | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadTrackers();
  }, []);

  const loadTrackers = async () => {
    const { data: trackersData } = await (supabase as any)
      .from("industry_trackers")
      .select("*")
      .order("updated_at", { ascending: false });

    const withStats = await Promise.all(
      (trackersData || []).map(async (tracker: any) => {
        const buyersRes = await supabase.from("remarketing_buyers").select("id, data_completeness").eq("industry_tracker_id", tracker.id);
        const dealsRes = await supabase.from("deals").select("id").eq("listing_id", tracker.id);
        const buyerIds = (buyersRes.data || []).map((b: any) => b.id);
        const transcriptsRes = buyerIds.length > 0
          ? await supabase.from("buyer_transcripts").select("buyer_id").in("buyer_id", buyerIds.slice(0, 100))
          : { data: [] };
        const buyers = (buyersRes.data || []) as any[];
        const transcripts = transcriptsRes.data || [];
        const buyerIdsWithTranscripts = new Set(transcripts.map((t: any) => t.buyer_id));
        
        // Count enriched buyers (high or medium data_completeness)
        const enrichedCount = buyers.filter(b => 
          b.data_completeness === 'high' || b.data_completeness === 'medium'
        ).length;
        
        // Count buyers with transcripts
        const transcriptCount = buyers.filter(b => buyerIdsWithTranscripts.has(b.id)).length;
        
        return {
          id: tracker.id,
          industry_name: tracker.name || tracker.industry_name || 'Unknown',
          archived: !tracker.is_active,
          updated_at: tracker.updated_at,
          buyer_count: buyers.length,
          deal_count: dealsRes.data?.length || 0,
          enriched_count: enrichedCount,
          transcript_count: transcriptCount
        } as TrackerWithStats;
      })
    );
    setTrackers(withStats);
    setIsLoading(false);
  };

  const handleArchiveToggle = async (e: React.MouseEvent, tracker: TrackerWithStats) => {
    e.stopPropagation();
    // Use is_active (inverted) since is_archived doesn't exist in schema
    const { error } = await (supabase as any)
      .from("industry_trackers")
      .update({ is_active: tracker.archived }) // If archived, set active; if active, set inactive
      .eq("id", tracker.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update archive status", variant: "destructive" });
    } else {
      toast({ title: tracker.archived ? "Universe restored" : "Universe archived" });
      loadTrackers();
    }
  };

  const confirmDeleteTracker = (e: React.MouseEvent, tracker: TrackerWithStats) => {
    e.stopPropagation();
    setTrackerToDelete(tracker);
    setDeleteDialogOpen(true);
  };

  const deleteTracker = async () => {
    if (!trackerToDelete) return;

    const { error } = await deleteTrackerWithRelated(trackerToDelete.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Universe deleted", description: `${trackerToDelete.industry_name} has been permanently deleted` });
      loadTrackers();
    }

    setDeleteDialogOpen(false);
    setTrackerToDelete(null);
  };

  const filteredTrackers = trackers.filter(t => showArchived ? t.archived : !t.archived);
  const archivedCount = trackers.filter(t => t.archived).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Buyer Universes</h1>
          <p className="text-muted-foreground">Manage your curated buyer universes per industry vertical</p>
        </div>
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/admin/ma-intelligence/trackers/new">
              <Plus className="w-4 h-4 mr-2" />
              New Buyer Universe
            </Link>
          </Button>
        </div>
      </div>

      {archivedCount > 0 && (
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">
            Show archived ({archivedCount})
          </Label>
        </div>
      )}

      {filteredTrackers.length === 0 ? (
        <div className="bg-card rounded-lg border p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">{showArchived ? "No archived universes" : "No buyer universes yet"}</h3>
          <p className="text-muted-foreground mb-4">
            {showArchived ? "Archived universes will appear here." : "Create your first universe to start building institutional memory."}
          </p>
          {!showArchived && (
            <Button asChild>
              <Link to="/admin/ma-intelligence/trackers/new">
                <Plus className="w-4 h-4 mr-2" />
                Create Universe
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[250px]">
                  <div className="flex items-center gap-1">
                    Industry <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                  </div>
                </TableHead>
                <TableHead className="w-[100px] text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Buyers
                  </div>
                </TableHead>
                <TableHead className="w-[100px] text-center">
                  <div className="flex items-center justify-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Deals
                  </div>
                </TableHead>
                <TableHead className="w-[200px]">Intelligence Coverage</TableHead>
                <TableHead className="w-[120px] text-center">Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrackers.map((t) => {
                // Two-tier intel: website (up to 50%) + transcripts (up to 50%)
                const websiteIntel = t.buyer_count > 0 ? Math.round((t.enriched_count / t.buyer_count) * 50) : 0;
                const transcriptIntel = t.buyer_count > 0 ? Math.round((t.transcript_count / t.buyer_count) * 50) : 0;
                const intelligencePercent = websiteIntel + transcriptIntel;
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/admin/ma-intelligence/trackers/${t.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        {t.industry_name}
                        {t.archived && <Badge variant="outline" className="ml-2 text-xs">Archived</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{t.buyer_count}</TableCell>
                    <TableCell className="text-center">{t.deal_count}</TableCell>
                    <TableCell>
                      <IntelligenceCoverageBar 
                        intelligentCount={t.transcript_count} 
                        totalCount={t.buyer_count}
                        enrichedCount={t.enriched_count}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={intelligencePercent >= 70 ? "default" : intelligencePercent >= 40 ? "secondary" : "outline"}>
                        {intelligencePercent}% intel
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleArchiveToggle(e, t)}>
                            {t.archived ? <ArchiveRestore className="w-4 h-4 mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
                            {t.archived ? "Restore" : "Archive"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => confirmDeleteTracker(e, t)} className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete permanently
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {trackerToDelete?.industry_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this buyer universe including {trackerToDelete?.buyer_count || 0} buyers and {trackerToDelete?.deal_count || 0} deals. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTracker} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
