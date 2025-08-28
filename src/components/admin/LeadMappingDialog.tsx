import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, MapPin, User, Mail } from "lucide-react";
import { InboundLead } from "@/hooks/admin/use-inbound-leads";
import { useAdminListings } from "@/hooks/admin/use-admin-listings";

interface LeadMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (listingId: string, listingTitle: string) => void;
  lead: InboundLead | null;
  isLoading?: boolean;
}

export const LeadMappingDialog = ({
  isOpen,
  onClose,
  onConfirm,
  lead,
  isLoading = false
}: LeadMappingDialogProps) => {
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: listings = [] } = useAdminListings();

  // Filter listings based on search query
  const filteredListings = listings.filter(listing =>
    listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.internal_company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedListing = listings.find(l => l.id === selectedListingId);

  const handleConfirm = () => {
    if (selectedListing) {
      onConfirm(selectedListing.id, selectedListing.title);
      setSelectedListingId("");
      setSearchQuery("");
    }
  };

  const handleClose = () => {
    setSelectedListingId("");
    setSearchQuery("");
    onClose();
  };

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Map Lead to Listing</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Information */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Lead Information</h3>
              <div className="bg-card/50 border border-border/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{lead.name}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{lead.email}</span>
                </div>
                
                {lead.company_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{lead.company_name}</span>
                  </div>
                )}
                
                {lead.role && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Role:</span> {lead.role}
                  </div>
                )}
                
                {lead.message && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Message:</span>
                    <p className="mt-1 p-2 bg-background/50 border border-border/30 rounded text-xs">
                      {lead.message}
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    {lead.source === 'webflow' ? 'Webflow' : 'Manual'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Priority: {lead.priority_score}/10
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Listing Selection */}
          <div className="space-y-4 flex flex-col overflow-hidden">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Select Listing</h3>
              
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search listings..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              {/* Listing Selection */}
              <div className="space-y-2 overflow-y-auto max-h-64 border border-border/50 rounded-lg p-2">
                {filteredListings.map((listing) => (
                  <div
                    key={listing.id}
                    className={`p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedListingId === listing.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border/30 hover:border-border/60 hover:bg-accent/20'
                    }`}
                    onClick={() => setSelectedListingId(listing.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">{listing.title}</h4>
                        {listing.internal_company_name && (
                          <p className="text-xs text-muted-foreground">
                            Company: {listing.internal_company_name}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{listing.category}</span>
                          <span>•</span>
                          <span>{listing.location}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div>Rev: ${(listing.revenue / 1000000).toFixed(1)}M</div>
                        <div>EBITDA: ${(listing.ebitda / 1000000).toFixed(1)}M</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredListings.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    No listings found matching your search.
                  </div>
                )}
              </div>
            </div>
            
            {/* Selected Listing Preview */}
            {selectedListing && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-primary mb-2">Selected Listing</h4>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{selectedListing.title}</div>
                  {selectedListing.internal_company_name && (
                    <div className="text-muted-foreground">
                      Company: {selectedListing.internal_company_name}
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    {selectedListing.category} • {selectedListing.location}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedListingId || isLoading}
            className="flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            {isLoading ? "Mapping..." : "Map to Listing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};