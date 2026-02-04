import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { TrackerBuyersToolbar } from "./TrackerBuyersToolbar";
import { TrackerBuyersTable } from "./TrackerBuyersTable";
import { AddBuyerDialog } from "./AddBuyerDialog";
import { useToast } from "@/hooks/use-toast";
import type { MABuyer } from "@/lib/ma-intelligence/types";
import { useRealtimeTrackerBuyers } from "@/hooks/ma-intelligence/useRealtimeTrackerBuyers";

interface TrackerBuyersTabProps {
  trackerId: string;
  onBuyerCountChange?: (count: number) => void;
}

export function TrackerBuyersTab({ trackerId, onBuyerCountChange }: TrackerBuyersTabProps) {
  const [buyers, setBuyers] = useState<MABuyer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [addBuyerDialogOpen, setAddBuyerDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCoverage, setFilterCoverage] = useState<"all" | "high" | "medium" | "low">("all");
  const { toast } = useToast();

  useEffect(() => {
    if (trackerId && trackerId !== 'new') {
      loadBuyers();
    }
  }, [trackerId]);

  const loadBuyers = async () => {
    if (!trackerId || trackerId === 'new') return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("remarketing_buyers")
        .select("*")
        .eq("industry_tracker_id", trackerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setBuyers(data as any[] || []);
      onBuyerCountChange?.(data?.length || 0);
    } catch (error: any) {
      toast({
        title: "Error loading buyers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useRealtimeTrackerBuyers({
    trackerId,
    enabled: !!trackerId && trackerId !== "new",
    buyers,
    onChange: setBuyers,
    onRefresh: loadBuyers,
  });

  const handleBulkEnrich = async () => {
    if (selectedBuyers.size === 0) {
      toast({
        title: "No buyers selected",
        description: "Please select buyers to enrich",
        variant: "destructive",
      });
      return;
    }

    setIsEnriching(true);
    try {
      const buyerIds = Array.from(selectedBuyers);

      // Call enrichment edge function for each buyer
      for (const buyerId of buyerIds) {
        await supabase.functions.invoke("enrich-buyer", {
          body: { buyer_id: buyerId },
        });
      }

      toast({
        title: "Enrichment started",
        description: `Enriching ${buyerIds.length} buyers in the background`,
      });

      // Reload buyers after a delay
      setTimeout(() => {
        loadBuyers();
        setSelectedBuyers(new Set());
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Error enriching buyers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleBulkScore = async (dealId: string) => {
    if (selectedBuyers.size === 0) {
      toast({
        title: "No buyers selected",
        description: "Please select buyers to score",
        variant: "destructive",
      });
      return;
    }

    try {
      const buyerIds = Array.from(selectedBuyers);

      // Call scoring edge function
      await supabase.functions.invoke("score-buyer-deal", {
        body: {
          buyer_ids: buyerIds,
          deal_id: dealId,
        },
      });

      toast({
        title: "Scoring started",
        description: `Scoring ${buyerIds.length} buyers against the deal`,
      });

      setSelectedBuyers(new Set());
    } catch (error: any) {
      toast({
        title: "Error scoring buyers",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleSelect = (buyerId: string) => {
    const newSelected = new Set(selectedBuyers);
    if (newSelected.has(buyerId)) {
      newSelected.delete(buyerId);
    } else {
      newSelected.add(buyerId);
    }
    setSelectedBuyers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedBuyers.size === buyers.length) {
      setSelectedBuyers(new Set());
    } else {
      setSelectedBuyers(new Set(buyers.map(b => b.id)));
    }
  };

  const filteredBuyers = buyers.filter(buyer => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        buyer.pe_firm_name?.toLowerCase().includes(query) ||
        buyer.platform_company_name?.toLowerCase().includes(query) ||
        buyer.hq_city?.toLowerCase().includes(query) ||
        buyer.hq_state?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // Coverage filter
    if (filterCoverage !== "all") {
      // Calculate coverage - simplified version
      const hasThesis = !!buyer.thesis_summary;
      const hasGeo = !!buyer.geo_preferences;
      const hasSize = !!buyer.min_revenue || !!buyer.max_revenue;
      const filledFields = [hasThesis, hasGeo, hasSize].filter(Boolean).length;
      const coverage = filledFields >= 2 ? "high" : filledFields === 1 ? "medium" : "low";

      if (coverage !== filterCoverage) return false;
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TrackerBuyersToolbar
        selectedCount={selectedBuyers.size}
        totalCount={buyers.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterCoverage={filterCoverage}
        onFilterCoverageChange={setFilterCoverage}
        onAddBuyer={() => setAddBuyerDialogOpen(true)}
        onBulkEnrich={handleBulkEnrich}
        onBulkScore={handleBulkScore}
        isEnriching={isEnriching}
      />

      <Card>
        <CardContent className="p-0">
          <TrackerBuyersTable
            buyers={filteredBuyers}
            selectedBuyers={selectedBuyers}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onRefresh={loadBuyers}
          />
        </CardContent>
      </Card>

      <AddBuyerDialog
        open={addBuyerDialogOpen}
        onOpenChange={setAddBuyerDialogOpen}
        trackerId={trackerId}
        onBuyerAdded={loadBuyers}
      />
    </div>
  );
}
