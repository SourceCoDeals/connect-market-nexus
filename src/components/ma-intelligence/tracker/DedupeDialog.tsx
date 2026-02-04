import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, GitMerge, AlertCircle, Building2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MABuyer } from "@/lib/ma-intelligence/types";

interface DedupeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackerId: string;
  onDedupeComplete?: () => void;
}

interface DuplicateGroup {
  id: string;
  buyers: MABuyer[];
  similarityScore: number;
  matchReason: string;
}

export function DedupeDialog({
  open,
  onOpenChange,
  trackerId,
  onDedupeComplete,
}: DedupeDialogProps) {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMerging, setIsMerging] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && trackerId) {
      findDuplicates();
    }
  }, [open, trackerId]);

  const findDuplicates = async () => {
    if (!trackerId || trackerId === 'new') return;

    setIsLoading(true);
    try {
      // Load all buyers for this tracker
      const { data: buyers, error } = await supabase
        .from("remarketing_buyers")
        .select("*")
        .eq("industry_tracker_id", trackerId);

      if (error) throw error;

      // Find duplicate groups using simple matching logic
      const groups: DuplicateGroup[] = [];
      const processed = new Set<string>();

      (buyers || []).forEach((buyer, index) => {
        if (processed.has(buyer.id)) return;

        const duplicates = (buyers || []).filter((other, otherIndex) => {
          if (otherIndex <= index || processed.has(other.id)) return false;

          // Match by PE firm name similarity
          const firmMatch = buyer.pe_firm_name?.toLowerCase() === other.pe_firm_name?.toLowerCase();

          // Match by website (domain)
          const websiteMatch = buyer.platform_website && other.platform_website &&
            extractDomain(buyer.platform_website) === extractDomain(other.platform_website);

          // Match by platform name similarity
          const platformMatch = buyer.platform_company_name && other.platform_company_name &&
            buyer.platform_company_name.toLowerCase() === other.platform_company_name.toLowerCase();

          return firmMatch || websiteMatch || platformMatch;
        });

        if (duplicates.length > 0) {
          const allBuyers = [buyer, ...duplicates];
          allBuyers.forEach(b => processed.add(b.id));

          let matchReason = '';
          if (duplicates.some(d => d.pe_firm_name?.toLowerCase() === buyer.pe_firm_name?.toLowerCase())) {
            matchReason = 'Same PE firm name';
          } else if (duplicates.some(d => d.platform_website && extractDomain(d.platform_website) === extractDomain(buyer.platform_website || ''))) {
            matchReason = 'Same website domain';
          } else if (duplicates.some(d => d.platform_company_name?.toLowerCase() === buyer.platform_company_name?.toLowerCase())) {
            matchReason = 'Same platform name';
          }

          groups.push({
            id: `group-${groups.length}`,
            buyers: allBuyers as MABuyer[],
            similarityScore: 95,
            matchReason,
          });
        }
      });

      setDuplicateGroups(groups);

      if (groups.length === 0) {
        toast({
          title: "No duplicates found",
          description: "All buyers appear to be unique",
        });
        onOpenChange(false);
      } else {
        // Auto-select the most complete buyer
        const firstGroup = groups[0];
        const mostComplete = findMostCompleteBuyer(firstGroup.buyers);
        setSelectedBuyerId(mostComplete.id);
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

  const extractDomain = (url: string): string => {
    try {
      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      return domain.replace('www.', '');
    } catch {
      return url;
    }
  };

  const findMostCompleteBuyer = (buyers: MABuyer[]): MABuyer => {
    return buyers.reduce((best, current) => {
      const bestScore = calculateCompletenessScore(best);
      const currentScore = calculateCompletenessScore(current);
      return currentScore > bestScore ? current : best;
    });
  };

  const calculateCompletenessScore = (buyer: MABuyer): number => {
    let score = 0;
    if (buyer.thesis_summary) score += 10;
    if (buyer.min_revenue) score += 5;
    if (buyer.max_revenue) score += 5;
    if (buyer.target_geographies?.length) score += 5;
    if (buyer.target_services?.length) score += 5;
    if (buyer.business_summary) score += 10;
    if (buyer.platform_website) score += 5;
    if (buyer.recent_acquisitions?.length) score += 10;
    return score;
  };

  const handleMerge = async () => {
    if (!selectedBuyerId) {
      toast({
        title: "No buyer selected",
        description: "Please select which buyer to keep",
        variant: "destructive",
      });
      return;
    }

    const currentGroup = duplicateGroups[currentGroupIndex];
    const buyersToDelete = currentGroup.buyers
      .filter(b => b.id !== selectedBuyerId)
      .map(b => b.id);

    setIsMerging(true);
    try {
      // Delete duplicate buyers
      const { error } = await supabase
        .from("remarketing_buyers")
        .delete()
        .in("id", buyersToDelete);

      if (error) throw error;

      toast({
        title: "Buyers merged",
        description: `Merged ${buyersToDelete.length} duplicate${buyersToDelete.length > 1 ? 's' : ''}`,
      });

      // Move to next group or close
      if (currentGroupIndex < duplicateGroups.length - 1) {
        const nextIndex = currentGroupIndex + 1;
        setCurrentGroupIndex(nextIndex);
        const nextGroup = duplicateGroups[nextIndex];
        const mostComplete = findMostCompleteBuyer(nextGroup.buyers);
        setSelectedBuyerId(mostComplete.id);
      } else {
        onDedupeComplete?.();
        onOpenChange(false);
        toast({
          title: "Deduplication complete",
          description: `Processed ${duplicateGroups.length} duplicate group${duplicateGroups.length > 1 ? 's' : ''}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Merge failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  const handleSkip = () => {
    if (currentGroupIndex < duplicateGroups.length - 1) {
      const nextIndex = currentGroupIndex + 1;
      setCurrentGroupIndex(nextIndex);
      const nextGroup = duplicateGroups[nextIndex];
      const mostComplete = findMostCompleteBuyer(nextGroup.buyers);
      setSelectedBuyerId(mostComplete.id);
    } else {
      onOpenChange(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (duplicateGroups.length === 0) {
    return null;
  }

  const currentGroup = duplicateGroups[currentGroupIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Merge Duplicate Buyers
          </DialogTitle>
          <DialogDescription>
            Found {duplicateGroups.length} duplicate group{duplicateGroups.length > 1 ? 's' : ''}.
            Reviewing group {currentGroupIndex + 1} of {duplicateGroups.length}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Match reason:</strong> {currentGroup.matchReason}
            </AlertDescription>
          </Alert>

          <div>
            <Label className="text-base mb-3 block">
              Select which buyer to keep (others will be deleted):
            </Label>
            <RadioGroup value={selectedBuyerId} onValueChange={setSelectedBuyerId}>
              <div className="space-y-3">
                {currentGroup.buyers.map((buyer) => {
                  const completeness = calculateCompletenessScore(buyer);
                  const isRecommended = buyer.id === findMostCompleteBuyer(currentGroup.buyers).id;

                  return (
                    <div
                      key={buyer.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-colors ${
                        selectedBuyerId === buyer.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={buyer.id} id={buyer.id} className="mt-1" />
                      <Label htmlFor={buyer.id} className="flex-1 cursor-pointer">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {buyer.platform_company_name || buyer.pe_firm_name}
                                </span>
                                {isRecommended && (
                                  <Badge variant="default" className="text-xs">
                                    Most Complete
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {buyer.pe_firm_name}
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {completeness}% complete
                            </Badge>
                          </div>

                          {buyer.platform_website && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <ExternalLink className="w-3 h-3" />
                              {buyer.platform_website}
                            </div>
                          )}

                          {buyer.thesis_summary && (
                            <p className="text-sm line-clamp-2">{buyer.thesis_summary}</p>
                          )}

                          <div className="flex flex-wrap gap-2 pt-1">
                            {buyer.min_revenue && (
                              <Badge variant="outline" className="text-xs">
                                Min: ${(buyer.min_revenue / 1000000).toFixed(1)}M
                              </Badge>
                            )}
                            {buyer.max_revenue && (
                              <Badge variant="outline" className="text-xs">
                                Max: ${(buyer.max_revenue / 1000000).toFixed(1)}M
                              </Badge>
                            )}
                            {buyer.target_geographies && buyer.target_geographies.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {buyer.target_geographies.length} geo{buyer.target_geographies.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {currentGroupIndex + 1} of {duplicateGroups.length} groups
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkip} disabled={isMerging}>
              Skip
            </Button>
            <Button onClick={handleMerge} disabled={isMerging || !selectedBuyerId}>
              {isMerging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge className="w-4 h-4 mr-2" />
                  Merge & Continue
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
