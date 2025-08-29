import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, ArrowRight, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { InboundLead } from "@/hooks/admin/use-inbound-leads";
import { toast } from "@/hooks/use-toast";

interface BulkLeadActionsProps {
  selectedLeads: InboundLead[];
  onBulkMap: (listingId: string, listingTitle: string) => void;
  onBulkConvert: () => void;
  onClearSelection: () => void;
}

interface BulkMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (listingId: string, listingTitle: string) => void;
  pendingLeads: InboundLead[];
  isLoading?: boolean;
}

interface BulkConversionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mappedLeads: InboundLead[];
  isLoading?: boolean;
}

const BulkMappingDialog = ({
  isOpen,
  onClose,
  onConfirm,
  pendingLeads,
  isLoading = false
}: BulkMappingDialogProps) => {
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [selectedListingTitle, setSelectedListingTitle] = useState<string>("");

  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['admin-listings-for-mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, deal_identifier')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleConfirm = () => {
    if (selectedListingId && selectedListingTitle) {
      onConfirm(selectedListingId, selectedListingTitle);
      setSelectedListingId("");
      setSelectedListingTitle("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Bulk Map to Listing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Map {pendingLeads.length} pending leads to a single listing. All selected leads must have "pending" status.
            </AlertDescription>
          </Alert>

          <div>
            <label className="text-sm font-medium">Select Listing</label>
            <Select
              value={selectedListingId}
              onValueChange={(value) => {
                setSelectedListingId(value);
                const listing = listings?.find(l => l.id === value);
                setSelectedListingTitle(listing?.title || "");
              }}
              disabled={listingsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a listing..." />
              </SelectTrigger>
              <SelectContent>
                {listings?.map((listing) => (
                  <SelectItem key={listing.id} value={listing.id}>
                    {listing.deal_identifier ? `${listing.deal_identifier} - ` : ""}{listing.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Leads to be mapped:</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {pendingLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between text-xs border rounded p-2">
                  <span>{lead.name} ({lead.email})</span>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedListingId || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              Map {pendingLeads.length} Leads
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BulkConversionDialog = ({
  isOpen,
  onClose,
  onConfirm,
  mappedLeads,
  isLoading = false
}: BulkConversionDialogProps) => {
  const groupedByListing = mappedLeads.reduce((acc, lead) => {
    const listingId = lead.mapped_to_listing_id!;
    if (!acc[listingId]) {
      acc[listingId] = {
        title: lead.mapped_to_listing_title || "Unknown Listing",
        leads: []
      };
    }
    acc[listingId].leads.push(lead);
    return acc;
  }, {} as Record<string, { title: string; leads: InboundLead[] }>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Bulk Convert to Requests
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Convert {mappedLeads.length} mapped leads to connection requests. All selected leads must be mapped to listings.
            </AlertDescription>
          </Alert>

          <div>
            <h4 className="text-sm font-medium mb-2">Leads grouped by listing:</h4>
            <div className="max-h-48 overflow-y-auto space-y-3">
              {Object.entries(groupedByListing).map(([listingId, group]) => (
                <div key={listingId} className="border rounded p-3">
                  <div className="font-medium text-sm mb-2">{group.title}</div>
                  <div className="space-y-1">
                    {group.leads.map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between text-xs">
                        <span>{lead.name} ({lead.email})</span>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          Mapped
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Convert {mappedLeads.length} Leads
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const BulkLeadActions = ({
  selectedLeads,
  onBulkMap,
  onBulkConvert,
  onClearSelection
}: BulkLeadActionsProps) => {
  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [isConversionDialogOpen, setIsConversionDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const pendingLeads = selectedLeads.filter(lead => lead.status === 'pending');
  const mappedLeads = selectedLeads.filter(lead => lead.status === 'mapped');

  const handleBulkMapping = async (listingId: string, listingTitle: string) => {
    setIsProcessing(true);
    try {
      await onBulkMap(listingId, listingTitle);
      setIsMappingDialogOpen(false);
      onClearSelection();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkConversion = async () => {
    setIsProcessing(true);
    try {
      await onBulkConvert();
      setIsConversionDialogOpen(false);
      onClearSelection();
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedLeads.length === 0) return null;

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
          </Badge>
          
          <div className="flex items-center gap-2">
            {pendingLeads.length > 0 && (
              <Button
                size="sm"
                onClick={() => setIsMappingDialogOpen(true)}
                className="flex items-center gap-1"
              >
                <MapPin className="h-3 w-3" />
                Map {pendingLeads.length} to Listing
              </Button>
            )}
            
            {mappedLeads.length > 0 && (
              <Button
                size="sm"
                onClick={() => setIsConversionDialogOpen(true)}
                className="flex items-center gap-1"
              >
                <ArrowRight className="h-3 w-3" />
                Convert {mappedLeads.length} to Requests
              </Button>
            )}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onClearSelection}
        >
          Clear Selection
        </Button>
      </div>
      
      {/* Summary of selection */}
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        {pendingLeads.length > 0 && <span>{pendingLeads.length} pending</span>}
        {mappedLeads.length > 0 && <span>{mappedLeads.length} mapped</span>}
        {selectedLeads.filter(l => l.status === 'converted').length > 0 && (
          <span>{selectedLeads.filter(l => l.status === 'converted').length} converted</span>
        )}
      </div>

      {/* Dialogs */}
      <BulkMappingDialog
        isOpen={isMappingDialogOpen}
        onClose={() => setIsMappingDialogOpen(false)}
        onConfirm={handleBulkMapping}
        pendingLeads={pendingLeads}
        isLoading={isProcessing}
      />
      
      <BulkConversionDialog
        isOpen={isConversionDialogOpen}
        onClose={() => setIsConversionDialogOpen(false)}
        onConfirm={handleBulkConversion}
        mappedLeads={mappedLeads}
        isLoading={isProcessing}
      />
    </div>
  );
};