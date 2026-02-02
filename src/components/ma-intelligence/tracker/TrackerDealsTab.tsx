import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { TrackerDealsToolbar } from "./TrackerDealsToolbar";
import { TrackerDealsTable } from "./TrackerDealsTable";
import { DealCSVImport } from "../DealCSVImport";
import { useToast } from "@/hooks/use-toast";
import type { MADeal } from "@/lib/ma-intelligence/types";

interface TrackerDealsTabProps {
  trackerId: string;
  onDealCountChange?: (count: number) => void;
}

export function TrackerDealsTab({ trackerId, onDealCountChange }: TrackerDealsTabProps) {
  const [deals, setDeals] = useState<MADeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    if (trackerId && trackerId !== 'new') {
      loadDeals();
    }
  }, [trackerId]);

  const loadDeals = async () => {
    if (!trackerId || trackerId === 'new') return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("listing_id", trackerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDeals(data as any[] || []);
      onDealCountChange?.(data?.length || 0);
    } catch (error: any) {
      toast({
        title: "Error loading deals",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkEnrich = async () => {
    if (selectedDeals.size === 0) {
      toast({
        title: "No deals selected",
        description: "Please select deals to enrich",
        variant: "destructive",
      });
      return;
    }

    setIsEnriching(true);
    try {
      const dealIds = Array.from(selectedDeals);

      // Call enrichment edge function for each deal
      for (const dealId of dealIds) {
        await supabase.functions.invoke("enrich-deal", {
          body: { deal_id: dealId },
        });
      }

      toast({
        title: "Enrichment started",
        description: `Enriching ${dealIds.length} deals in the background`,
      });

      // Reload deals after a delay
      setTimeout(() => {
        loadDeals();
        setSelectedDeals(new Set());
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Error enriching deals",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleBulkScore = async () => {
    if (selectedDeals.size === 0) {
      toast({
        title: "No deals selected",
        description: "Please select deals to score",
        variant: "destructive",
      });
      return;
    }

    try {
      const dealIds = Array.from(selectedDeals);

      // Call scoring edge function for each deal
      for (const dealId of dealIds) {
        await supabase.functions.invoke("score-deal", {
          body: {
            deal_id: dealId,
            tracker_id: trackerId,
          },
        });
      }

      toast({
        title: "Scoring started",
        description: `Scoring ${dealIds.length} deals against all buyers`,
      });

      setSelectedDeals(new Set());
    } catch (error: any) {
      toast({
        title: "Error scoring deals",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleSelect = (dealId: string) => {
    const newSelected = new Set(selectedDeals);
    if (newSelected.has(dealId)) {
      newSelected.delete(dealId);
    } else {
      newSelected.add(dealId);
    }
    setSelectedDeals(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDeals.size === deals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(deals.map(d => d.id)));
    }
  };

  const filteredDeals = deals.filter(deal => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        deal.deal_name?.toLowerCase().includes(query) ||
        deal.company_website?.toLowerCase().includes(query) ||
        deal.headquarters?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // Status filter
    if (filterStatus !== "all" && deal.status !== filterStatus) {
      return false;
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
      <TrackerDealsToolbar
        selectedCount={selectedDeals.size}
        totalCount={deals.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        onAddDeal={() => setImportDialogOpen(true)}
        onBulkEnrich={handleBulkEnrich}
        onBulkScore={handleBulkScore}
        isEnriching={isEnriching}
      />

      <Card>
        <CardContent className="p-0">
          <TrackerDealsTable
            deals={filteredDeals}
            selectedDeals={selectedDeals}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onRefresh={loadDeals}
          />
        </CardContent>
      </Card>

      <DealCSVImport
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        trackerId={trackerId}
        onDealsImported={loadDeals}
      />
    </div>
  );
}
