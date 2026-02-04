import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DedupeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackerId: string;
}

interface DuplicateGroup {
  id: string;
  buyers: Array<{
    id: string;
    pe_firm_name: string;
    platform_company_name?: string;
    pe_firm_website?: string;
    created_at: string;
    data_last_updated?: string;
    has_enriched_data: boolean;
  }>;
  similarity: number;
  matchReason: string;
}

export function DedupeDialog({
  open,
  onOpenChange,
  trackerId,
}: DedupeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedPrimaries, setSelectedPrimaries] = useState<Record<string, string>>({});

  // Find duplicate buyers
  const { data: duplicateGroups = [], isLoading } = useQuery<DuplicateGroup[]>({
    queryKey: ['buyer-duplicates', trackerId],
    queryFn: async () => {
      // Fetch all buyers for this tracker
      const { data: buyers, error } = await supabase
        .from('buyers')
        .select('id, pe_firm_name, platform_company_name, pe_firm_website, created_at, data_last_updated')
        .eq('tracker_id', trackerId);

      if (error) throw error;
      if (!buyers || buyers.length === 0) return [];

      // Find duplicates based on:
      // 1. Exact match on pe_firm_name
      // 2. Similar pe_firm_name (fuzzy matching)
      // 3. Same pe_firm_website
      const groups: DuplicateGroup[] = [];
      const processed = new Set<string>();

      buyers.forEach((buyer, index) => {
        if (processed.has(buyer.id)) return;

        const duplicates = buyers.filter((other, otherIndex) => {
          if (otherIndex <= index || processed.has(other.id)) return false;

          // Exact name match
          if (buyer.pe_firm_name?.toLowerCase() === other.pe_firm_name?.toLowerCase()) {
            return true;
          }

          // Same website
          if (buyer.pe_firm_website && other.pe_firm_website &&
              buyer.pe_firm_website === other.pe_firm_website) {
            return true;
          }

          // Fuzzy name matching (remove punctuation, extra spaces)
          const normalizeName = (name: string) =>
            name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

          const normalizedBuyer = normalizeName(buyer.pe_firm_name || '');
          const normalizedOther = normalizeName(other.pe_firm_name || '');

          if (normalizedBuyer && normalizedOther && normalizedBuyer === normalizedOther) {
            return true;
          }

          return false;
        });

        if (duplicates.length > 0) {
          const allBuyers = [buyer, ...duplicates];
          allBuyers.forEach(b => processed.add(b.id));

          // Determine match reason
          let matchReason = 'Exact name match';
          if (allBuyers.some(b => b.pe_firm_website === buyer.pe_firm_website)) {
            matchReason = 'Same website';
          }

          groups.push({
            id: `group-${index}`,
            buyers: allBuyers.map(b => ({
              ...b,
              has_enriched_data: !!(b.data_last_updated && b.data_last_updated !== b.created_at),
            })),
            similarity: 100, // Percentage similarity
            matchReason,
          });
        }
      });

      return groups;
    },
    enabled: open && !!trackerId,
  });

  // Merge duplicates mutation
  const mergeMutation = useMutation({
    mutationFn: async () => {
      const mergeOperations = Array.from(selectedGroups).map(async (groupId) => {
        const group = duplicateGroups.find(g => g.id === groupId);
        if (!group) return;

        const primaryId = selectedPrimaries[groupId];
        if (!primaryId) {
          throw new Error(`No primary buyer selected for group ${groupId}`);
        }

        const duplicateIds = group.buyers
          .filter(b => b.id !== primaryId)
          .map(b => b.id);

        // Update all references to point to the primary buyer
        // This includes buyer_deal_scores, buyer_contacts, etc.
        await Promise.all([
          // Update buyer_deal_scores
          supabase
            .from('buyer_deal_scores')
            .update({ buyer_id: primaryId })
            .in('buyer_id', duplicateIds),

          // Update buyer_contacts
          supabase
            .from('buyer_contacts')
            .update({ buyer_id: primaryId })
            .in('buyer_id', duplicateIds),

          // Update any other tables referencing buyer_id
          // Add more as needed
        ]);

        // Delete the duplicate buyers
        const { error } = await supabase
          .from('buyers')
          .delete()
          .in('id', duplicateIds);

        if (error) throw error;

        return {
          groupId,
          primaryId,
          mergedCount: duplicateIds.length,
        };
      });

      return await Promise.all(mergeOperations);
    },
    onSuccess: (results) => {
      const totalMerged = results?.reduce((sum, r) => sum + (r?.mergedCount || 0), 0) || 0;
      toast({
        title: "Duplicates merged successfully",
        description: `Merged ${totalMerged} duplicate buyer${totalMerged !== 1 ? 's' : ''}`,
      });

      // Reset selections
      setSelectedGroups(new Set());
      setSelectedPrimaries({});

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['buyer-duplicates', trackerId] });
      queryClient.invalidateQueries({ queryKey: ['tracker-buyers', trackerId] });
      queryClient.invalidateQueries({ queryKey: ['tracker-stats', trackerId] });

      // Close dialog
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error merging duplicates",
        description: error.message,
      });
    },
  });

  const toggleGroupSelection = (groupId: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
      // Remove primary selection
      const newPrimaries = { ...selectedPrimaries };
      delete newPrimaries[groupId];
      setSelectedPrimaries(newPrimaries);
    } else {
      newSelected.add(groupId);
      // Auto-select the most enriched buyer as primary
      const group = duplicateGroups.find(g => g.id === groupId);
      if (group) {
        const mostEnriched = group.buyers.reduce((best, current) =>
          current.has_enriched_data && !best.has_enriched_data ? current : best
        );
        setSelectedPrimaries({
          ...selectedPrimaries,
          [groupId]: mostEnriched.id,
        });
      }
    }
    setSelectedGroups(newSelected);
  };

  const setPrimaryBuyer = (groupId: string, buyerId: string) => {
    setSelectedPrimaries({
      ...selectedPrimaries,
      [groupId]: buyerId,
    });
  };

  const canMerge = selectedGroups.size > 0 &&
    Array.from(selectedGroups).every(groupId => selectedPrimaries[groupId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Find and Merge Duplicate Buyers
          </DialogTitle>
          <DialogDescription>
            Select duplicate groups to merge. The primary buyer will be kept, and all data from duplicates will be transferred.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : duplicateGroups.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Duplicates Found</h3>
            <p className="text-muted-foreground">
              All buyers in this tracker appear to be unique.
            </p>
          </div>
        ) : (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Found {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''} of potential duplicates
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {duplicateGroups.map((group) => (
                  <Card key={group.id} className={selectedGroups.has(group.id) ? 'border-primary' : ''}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={group.id}
                            checked={selectedGroups.has(group.id)}
                            onCheckedChange={() => toggleGroupSelection(group.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{group.matchReason}</Badge>
                              <Badge>{group.similarity}% match</Badge>
                            </div>

                            <div className="space-y-2">
                              {group.buyers.map((buyer) => (
                                <div
                                  key={buyer.id}
                                  className={`p-3 rounded-lg border ${
                                    selectedPrimaries[group.id] === buyer.id
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium">{buyer.pe_firm_name}</p>
                                        {buyer.has_enriched_data && (
                                          <Badge variant="secondary" className="text-xs">
                                            Enriched
                                          </Badge>
                                        )}
                                      </div>
                                      {buyer.platform_company_name && (
                                        <p className="text-sm text-muted-foreground">
                                          Platform: {buyer.platform_company_name}
                                        </p>
                                      )}
                                      {buyer.pe_firm_website && (
                                        <p className="text-sm text-muted-foreground">
                                          {buyer.pe_firm_website}
                                        </p>
                                      )}
                                      <p className="text-xs text-muted-foreground">
                                        Created {new Date(buyer.created_at).toLocaleDateString()}
                                      </p>
                                    </div>
                                    {selectedGroups.has(group.id) && (
                                      <Button
                                        size="sm"
                                        variant={selectedPrimaries[group.id] === buyer.id ? "default" : "outline"}
                                        onClick={() => setPrimaryBuyer(group.id, buyer.id)}
                                      >
                                        {selectedPrimaries[group.id] === buyer.id ? "Primary" : "Set as Primary"}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mergeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => mergeMutation.mutate()}
                disabled={!canMerge || mergeMutation.isPending}
              >
                {mergeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Merge {selectedGroups.size} Group{selectedGroups.size !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
