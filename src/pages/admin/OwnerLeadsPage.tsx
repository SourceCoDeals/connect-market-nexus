import { useState, useEffect } from "react";
import { Building2, Loader2 } from "lucide-react";
import { useOwnerLeads, useUpdateOwnerLeadStatus, useUpdateOwnerLeadContacted } from "@/hooks/admin/use-owner-leads";
import { useUpdateOwnerLeadNotes } from "@/hooks/admin/use-update-owner-lead-notes";
import { useMarkOwnerLeadsViewed } from "@/hooks/admin/use-mark-owner-leads-viewed";
import { OwnerLeadsStats } from "@/components/admin/OwnerLeadsStats";
import { OwnerLeadsFilters } from "@/components/admin/OwnerLeadsFilters";
import { OwnerLeadsTableContent } from "@/components/admin/OwnerLeadsTableContent";
import { OwnerLead } from "@/hooks/admin/use-owner-leads";

const OwnerLeadsPage = () => {
  const { data: ownerLeads = [], isLoading: isLoadingOwnerLeads } = useOwnerLeads();
  const updateOwnerStatus = useUpdateOwnerLeadStatus();
  const updateOwnerNotes = useUpdateOwnerLeadNotes();
  const updateOwnerContacted = useUpdateOwnerLeadContacted();
  const { markAsViewed: markOwnerLeadsAsViewed } = useMarkOwnerLeadsViewed();
  const [filteredOwnerLeads, setFilteredOwnerLeads] = useState<OwnerLead[]>([]);

  useEffect(() => {
    markOwnerLeadsAsViewed();
  }, []);

  useEffect(() => {
    setFilteredOwnerLeads(ownerLeads);
  }, [ownerLeads]);

  const handleOwnerStatusChange = (id: string, status: string) => {
    updateOwnerStatus.mutate({ id, status });
  };

  const handleOwnerNotesUpdate = (id: string, notes: string) => {
    updateOwnerNotes.mutate({ id, notes });
  };

  const handleOwnerContactedChange = (id: string, contacted: boolean) => {
    updateOwnerContacted.mutate({ id, contacted });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="px-8 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Owner/Seller Leads</h1>
            <p className="text-sm text-muted-foreground">
              Business owner inquiries submitted through the /sell form. Track, qualify, and convert to deals.
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="space-y-6 mb-6">
          <OwnerLeadsStats leads={ownerLeads} />
          <OwnerLeadsFilters
            leads={ownerLeads}
            onFilteredLeadsChange={setFilteredOwnerLeads}
          />
        </div>

        <div className="bg-card rounded-lg border overflow-hidden">
          {isLoadingOwnerLeads ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOwnerLeads.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No owner inquiries yet</h3>
              <p className="text-sm text-muted-foreground">
                Owner inquiries from the /sell form will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <OwnerLeadsTableContent
                leads={filteredOwnerLeads}
                onStatusChange={handleOwnerStatusChange}
                onNotesUpdate={handleOwnerNotesUpdate}
                onContactedChange={handleOwnerContactedChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerLeadsPage;
