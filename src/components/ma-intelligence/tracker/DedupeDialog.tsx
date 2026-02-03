import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, GitMerge } from "lucide-react";

// Simplified buyer type for dedupe operations (matches DB response)
interface BuyerRecord {
  id: string;
  pe_firm_name: string | null;
  pe_firm_website: string | null;
  company_name: string | null;
  created_at: string;
}

interface DuplicateGroup {
  id: string;
  buyers: BuyerRecord[];
  reason: string;
  similarity: number;
}

interface DedupeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackerId: string;
  onDedupeComplete: () => void;
}

export function DedupeDialog({ open, onOpenChange, trackerId, onDedupeComplete }: DedupeDialogProps) {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMerges, setSelectedMerges] = useState<Map<string, string>>(new Map());
  const [isMerging, setIsMerging] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && trackerId && trackerId !== 'new') {
      findDuplicates();
    }
  }, [open, trackerId]);

  const findDuplicates = async () => {
    setIsLoading(true);
    try {
      const { data: buyers, error } = await supabase
        .from("remarketing_buyers")
        .select("id, pe_firm_name, pe_firm_website, company_name, created_at")
        .eq("universe_id", trackerId);

      if (error) throw error;

      // Simple duplicate detection based on PE firm name similarity
      const groups: DuplicateGroup[] = [];
      const processed = new Set<string>();

      buyers?.forEach((buyer, index) => {
        if (processed.has(buyer.id)) return;

        const similar = buyers.filter((other, otherIndex) => {
          if (otherIndex <= index || processed.has(other.id)) return false;

          // Check name similarity
          const nameSimilarity = calculateSimilarity(
            buyer.pe_firm_name?.toLowerCase() || "",
            other.pe_firm_name?.toLowerCase() || ""
          );

          // Check website similarity
          const websiteSimilarity = buyer.pe_firm_website && other.pe_firm_website
            ? calculateSimilarity(
                buyer.pe_firm_website.toLowerCase(),
                other.pe_firm_website.toLowerCase()
              )
            : 0;

          return nameSimilarity > 0.8 || websiteSimilarity > 0.9;
        });

        if (similar.length > 0) {
          const group: DuplicateGroup = {
            id: `group-${groups.length}`,
            buyers: [buyer, ...similar] as BuyerRecord[],
            reason: "Similar PE firm name or website",
            similarity: 85,
          };

          groups.push(group);
          processed.add(buyer.id);
          similar.forEach((s: BuyerRecord) => processed.add(s.id));
        }
      });

      setDuplicates(groups);

      if (groups.length === 0) {
        toast({
          title: "No duplicates found",
          description: "Your buyer universe looks clean!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error finding duplicates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    // Simple Levenshtein distance calculation
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() =>
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  };

  const handleSelectPrimary = (groupId: string, buyerId: string) => {
    const newSelected = new Map(selectedMerges);
    newSelected.set(groupId, buyerId);
    setSelectedMerges(newSelected);
  };

  const handleMerge = async () => {
    if (selectedMerges.size === 0) {
      toast({
        title: "No merges selected",
        description: "Please select primary buyers for each duplicate group",
        variant: "destructive",
      });
      return;
    }

    setIsMerging(true);
    try {
      // Call dedupe edge function
      await supabase.functions.invoke("dedupe-buyers", {
        body: {
          merges: Array.from(selectedMerges.entries()).map(([groupId, primaryId]) => {
            const group = duplicates.find(g => g.id === groupId);
            return {
              primary_buyer_id: primaryId,
              duplicate_ids: group?.buyers.filter(b => b.id !== primaryId).map(b => b.id) || [],
            };
          }),
        },
      });

      toast({
        title: "Duplicates merged successfully",
        description: `Merged ${selectedMerges.size} duplicate groups`,
      });

      onDedupeComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error merging duplicates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find & Merge Duplicates</DialogTitle>
          <DialogDescription>
            Review potential duplicate buyers and select which to keep
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : duplicates.length === 0 ? (
          <div className="text-center py-12">
            <GitMerge className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No duplicate buyers found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {duplicates.map((group) => (
              <Card key={group.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {group.buyers.length} duplicates
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {group.similarity}% similar • {group.reason}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.buyers.map((buyer) => (
                      <div
                        key={buyer.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          selectedMerges.get(group.id) === buyer.id
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <Checkbox
                          checked={selectedMerges.get(group.id) === buyer.id}
                          onCheckedChange={() => handleSelectPrimary(group.id, buyer.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{buyer.pe_firm_name || buyer.company_name}</div>
                          {buyer.pe_firm_website && (
                            <div className="text-sm text-muted-foreground">
                              {buyer.pe_firm_website}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Created: {new Date(buyer.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground mt-3">
                    Select the buyer to keep. Others will be merged into it.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {duplicates.length > 0 && (
            <Button onClick={handleMerge} disabled={isMerging || selectedMerges.size === 0}>
              {isMerging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <GitMerge className="w-4 h-4 mr-2" />
              Merge {selectedMerges.size} Group{selectedMerges.size !== 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
