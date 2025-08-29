import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus,
  Upload,
  Search,
  CheckSquare
} from "lucide-react";
import { InboundLead, useCreateInboundLead, useMapLeadToListing, useConvertLeadToRequest, useArchiveInboundLead, DuplicateCheckResult } from "@/hooks/admin/use-inbound-leads";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CreateInboundLeadDialog } from "./CreateInboundLeadDialog";
import { BulkLeadImportDialog } from "./BulkLeadImportDialog";
import { LeadMappingDialog } from "./LeadMappingDialog";
import { DuplicateWarningDialog } from "./DuplicateWarningDialog";
import { CompactLeadCard } from "./CompactLeadCard";
import { BulkLeadActions } from "./BulkLeadActions";

interface InboundLeadsTableProps {
  leads: InboundLead[];
  isLoading: boolean;
  onMapToListing: (lead: InboundLead) => void;
  onConvertToRequest: (leadId: string) => void;
  onArchive: (leadId: string) => void;
}

const InboundLeadsTableSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Card key={i}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-3 w-[200px]" />
              </div>
            </div>
            <Skeleton className="h-6 w-[80px]" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const InboundLeadsTableEmpty = () => (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-16">
      <Search className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold text-muted-foreground mb-2">No inbound leads found</h3>
      <p className="text-sm text-muted-foreground">Inbound leads from various sources will appear here.</p>
    </CardContent>
  </Card>
);

export const InboundLeadsTable = ({ 
  leads, 
  isLoading, 
  onMapToListing, 
  onConvertToRequest, 
  onArchive 
}: InboundLeadsTableProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<InboundLead | null>(null);
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [isDuplicateWarningOpen, setIsDuplicateWarningOpen] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [pendingMappingData, setPendingMappingData] = useState<{ listingId: string; listingTitle: string } | null>(null);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  
  // Bulk selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  const { mutate: createLead, isPending: isCreating } = useCreateInboundLead();
  const { mutate: mapLeadToListing, isPending: isMapping } = useMapLeadToListing();
  const { mutate: convertLead, isPending: isConverting } = useConvertLeadToRequest();
  const { mutate: archiveLead, isPending: isArchiving } = useArchiveInboundLead();

  const handleMapToListing = (lead: InboundLead) => {
    setSelectedLead(lead);
    setIsMappingDialogOpen(true);
  };

  const handleConfirmMapping = (listingId: string, listingTitle: string) => {
    if (selectedLead) {
      mapLeadToListing({
        leadId: selectedLead.id,
        listingId,
        listingTitle
      }, {
        onError: (error: any) => {
          if (error.isDuplicateError) {
            // Handle duplicate detection
            setDuplicateResult(error.duplicateResult);
            setPendingMappingData({ listingId, listingTitle });
            setIsDuplicateWarningOpen(true);
            setIsMappingDialogOpen(false);
          }
        }
      });
    }
  };

  const handleProceedWithMapping = () => {
    if (selectedLead && pendingMappingData) {
      mapLeadToListing({
        leadId: selectedLead.id,
        listingId: pendingMappingData.listingId,
        listingTitle: pendingMappingData.listingTitle,
        skipDuplicateCheck: true
      });
      setIsDuplicateWarningOpen(false);
      setIsMappingDialogOpen(false);
      setSelectedLead(null);
      setPendingMappingData(null);
      setDuplicateResult(null);
    }
  };

  const handleMergeWithExisting = (requestId: string) => {
    // For now, just show a toast - in a full implementation this would open the connection request
    toast({
      title: "Opening connection request",
      description: `Navigating to connection request ${requestId}`,
    });
    setIsDuplicateWarningOpen(false);
    setIsMappingDialogOpen(false);
    setSelectedLead(null);
    setPendingMappingData(null);
    setDuplicateResult(null);
  };

  // Filter leads based on search and filters
  const filteredLeads = leads.filter((lead) => {
    // Hide archived leads from main view unless specifically filtered for them
    const showArchived = statusFilter === "archived";
    if (lead.status === "archived" && !showArchived) {
      return false;
    }
    
    const matchesSearch = searchTerm === "" || 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.company_name && lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;
    
    return matchesSearch && matchesStatus && matchesSource;
  });

  const selectedLeads = filteredLeads.filter(lead => selectedLeadIds.has(lead.id));

  const handleBulkCreate = async (leadsData: any[]) => {
    try {
      // Enhanced duplicate checking with persistent warnings
      const emails = leadsData.map(lead => lead.email.toLowerCase());
      const { data: existingLeads, error: duplicateCheckError } = await supabase
        .from('inbound_leads')
        .select('email, name, company_name')
        .in('email', emails);

      if (duplicateCheckError) {
        throw duplicateCheckError;
      }

      const existingEmails = new Set(existingLeads?.map(lead => lead.email.toLowerCase()) || []);
      
      // Process leads with duplicate info
      const processedLeads = leadsData.map(leadData => {
        const isDuplicate = existingEmails.has(leadData.email.toLowerCase());
        if (isDuplicate) {
          const existingLead = existingLeads?.find(el => el.email.toLowerCase() === leadData.email.toLowerCase());
          return {
            ...leadData,
            is_duplicate: true,
            duplicate_info: `Duplicate email found: ${existingLead?.name || 'Unknown'} at ${existingLead?.company_name || 'Unknown company'}`
          };
        }
        return leadData;
      });

      // Create leads with duplicate tracking
      let successCount = 0;
      for (const leadData of processedLeads) {
        try {
          await new Promise((resolve, reject) => {
            createLead(leadData, {
              onSuccess: () => {
                successCount++;
                resolve(null);
              },
              onError: reject
            });
          });
        } catch (error) {
          console.error('Error creating lead:', error);
        }
      }
      
      if (successCount > 0) {
        const duplicateCount = processedLeads.filter(l => l.is_duplicate).length;
        toast({
          title: "Bulk import completed",
          description: `Imported ${successCount} leads${duplicateCount > 0 ? ` (${duplicateCount} marked as duplicates)` : ''}`,
        });
      }
    } catch (error: any) {
      console.error('Bulk create error:', error);
      toast({
        variant: "destructive",
        title: "Import failed",
        description: error.message || 'Failed to import leads',
      });
    }
  };

  const handleBulkMap = async (listingId: string, listingTitle: string) => {
    const pendingLeads = selectedLeads.filter(lead => lead.status === 'pending');
    
    try {
      // Get current admin user ID
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Authentication required');

      let successCount = 0;
      for (const lead of pendingLeads) {
        try {
          const { error } = await supabase
            .from('inbound_leads')
            .update({
              mapped_to_listing_id: listingId,
              mapped_to_listing_title: listingTitle,
              mapped_at: new Date().toISOString(),
              mapped_by: user.id,
              status: 'mapped',
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id);

          if (!error) successCount++;
        } catch (error) {
          console.error('Error mapping lead:', error);
        }
      }

      if (successCount > 0) {
        toast({
          title: "Bulk mapping completed",
          description: `Successfully mapped ${successCount} of ${pendingLeads.length} leads`,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Mapping failed",
        description: error.message || 'Failed to map leads',
      });
    }
  };

  const handleBulkConvert = async () => {
    const mappedLeads = selectedLeads.filter(lead => lead.status === 'mapped');
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const lead of mappedLeads) {
      try {
        await new Promise((resolve, reject) => {
          convertLead(lead.id, {
            onSuccess: () => {
              successCount++;
              resolve(null);
            },
            onError: (error: any) => {
              errorCount++;
              errors.push(`${lead.name}: ${error.message}`);
              reject(error);
            }
          });
        });
      } catch (error) {
        // Error already handled in onError callback
      }
    }

    if (successCount > 0) {
      toast({
        title: "Bulk conversion completed",
        description: `Successfully converted ${successCount} of ${mappedLeads.length} leads`,
      });
    }

    if (errorCount > 0) {
      toast({
        variant: "destructive",
        title: "Some conversions failed",
        description: `${errorCount} leads failed to convert. Check for duplicates.`,
      });
    }
  };

  const handleSelectionChange = (leadId: string, selected: boolean) => {
    const newSelection = new Set(selectedLeadIds);
    if (selected) {
      newSelection.add(leadId);
    } else {
      newSelection.delete(leadId);
    }
    setSelectedLeadIds(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map(lead => lead.id)));
    }
  };

  const clearSelection = () => {
    setSelectedLeadIds(new Set());
    setIsSelectMode(false);
  };

  if (isLoading) {
    return <InboundLeadsTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsBulkImportDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsSelectMode(!isSelectMode)}
            className="flex items-center gap-2"
          >
            <CheckSquare className="h-4 w-4" />
            {isSelectMode ? 'Exit Select' : 'Select Mode'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="mapped">Mapped</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="webflow">Webflow</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
            <SelectItem value="networking">Networking</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} found
        {leads.length !== filteredLeads.length && ` (${leads.length} total)`}
      </div>

      {/* Bulk Actions */}
      <BulkLeadActions
        selectedLeads={selectedLeads}
        onBulkMap={handleBulkMap}
        onBulkConvert={handleBulkConvert}
        onClearSelection={clearSelection}
      />

      {/* Leads Grid */}
      {filteredLeads.length === 0 ? (
        <InboundLeadsTableEmpty />
      ) : (
        <div className="space-y-4">
          {isSelectMode && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={handleSelectAll}
                className="text-primary hover:underline"
              >
                {selectedLeadIds.size === filteredLeads.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-muted-foreground">
                ({selectedLeadIds.size} selected)
              </span>
            </div>
          )}
          
          {/* 2-3 Column Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredLeads.map((lead) => (
              <CompactLeadCard
                key={lead.id}
                lead={lead}
                isSelected={selectedLeadIds.has(lead.id)}
                onSelectionChange={handleSelectionChange}
                onMapToListing={handleMapToListing}
                onConvertToRequest={onConvertToRequest}
                onArchive={onArchive}
                showCheckbox={isSelectMode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateInboundLeadDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onConfirm={(leadData) => {
          createLead(leadData);
          setIsCreateDialogOpen(false);
        }}
        isLoading={isCreating}
      />
      
      <BulkLeadImportDialog
        isOpen={isBulkImportDialogOpen}
        onClose={() => setIsBulkImportDialogOpen(false)}
        onConfirm={handleBulkCreate}
        isLoading={isCreating}
      />

      <LeadMappingDialog
        isOpen={isMappingDialogOpen}
        onClose={() => {
          setIsMappingDialogOpen(false);
          setSelectedLead(null);
        }}
        onConfirm={handleConfirmMapping}
        lead={selectedLead}
        isLoading={isMapping}
      />

      <DuplicateWarningDialog
        isOpen={isDuplicateWarningOpen}
        onClose={() => {
          setIsDuplicateWarningOpen(false);
          setDuplicateResult(null);
          setPendingMappingData(null);
          setSelectedLead(null);
        }}
        onProceed={handleProceedWithMapping}
        onMerge={handleMergeWithExisting}
        duplicateResult={duplicateResult}
        leadEmail={selectedLead?.email || ""}
        leadCompany={selectedLead?.company_name || ""}
        listingTitle={pendingMappingData?.listingTitle || ""}
      />
    </div>
  );
};