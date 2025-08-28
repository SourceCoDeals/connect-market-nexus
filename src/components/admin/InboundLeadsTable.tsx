import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Mail, 
  Phone, 
  Building2, 
  User, 
  MessageSquare,
  ExternalLink,
  MapPin,
  Archive,
  ArrowRight,
  Check,
  X,
  Plus,
  Upload
} from "lucide-react";
import { InboundLead, useCreateInboundLead, useMapLeadToListing, DuplicateCheckResult } from "@/hooks/admin/use-inbound-leads";
import { toast } from "@/hooks/use-toast";
import { CreateInboundLeadDialog } from "./CreateInboundLeadDialog";
import { BulkLeadImportDialog } from "./BulkLeadImportDialog";
import { LeadMappingDialog } from "./LeadMappingDialog";
import { DuplicateWarningDialog } from "./DuplicateWarningDialog";

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
      <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold text-muted-foreground mb-2">No inbound leads found</h3>
      <p className="text-sm text-muted-foreground">Inbound leads from Webflow and manual entries will appear here.</p>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'mapped':
        return {
          className: 'bg-primary/10 text-primary border-primary/20',
          icon: <MapPin className="h-3 w-3 mr-1" />
        };
      case 'converted':
        return {
          className: 'bg-success/10 text-success border-success/20',
          icon: <Check className="h-3 w-3 mr-1" />
        };
      case 'archived':
        return {
          className: 'bg-muted/50 text-muted-foreground border-border',
          icon: <Archive className="h-3 w-3 mr-1" />
        };
      default:
        return {
          className: 'bg-warning/10 text-warning border-warning/20',
          icon: <User className="h-3 w-3 mr-1" />
        };
    }
  };

  const config = getStatusConfig(status);
  const displayText = status.charAt(0).toUpperCase() + status.slice(1);
  
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.icon}
      {displayText}
    </Badge>
  );
};

const PriorityBadge = ({ score }: { score: number }) => {
  const getPriorityConfig = (score: number) => {
    if (score >= 8) {
      return {
        label: 'High',
        className: 'bg-destructive/10 text-destructive border-destructive/20'
      };
    } else if (score >= 6) {
      return {
        label: 'Medium',
        className: 'bg-warning/10 text-warning border-warning/20'
      };
    } else {
      return {
        label: 'Low',
        className: 'bg-muted/50 text-muted-foreground border-border'
      };
    }
  };

  const config = getPriorityConfig(score);
  
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
};

const SourceBadge = ({ source }: { source: string }) => {
  const labelMap: Record<string, string> = {
    webflow: 'Webflow',
    website: 'Website',
    referral: 'Referral',
    cold_outreach: 'Cold Outreach',
    networking: 'Networking',
    linkedin: 'LinkedIn',
    email: 'Email',
    manual: 'Manual',
  };
  const label = labelMap[source] || 'Manual';
  return (
    <Badge variant="outline" className="text-xs bg-secondary/10 text-secondary-foreground border-secondary/20">
      {label}
    </Badge>
  );
};

const LeadCard = ({ 
  lead, 
  onMapToListing, 
  onConvertToRequest, 
  onArchive 
}: { 
  lead: InboundLead;
  onMapToListing: (lead: InboundLead) => void;
  onConvertToRequest: (leadId: string) => void;
  onArchive: (leadId: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border border-border/50 hover:border-border transition-colors">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-foreground">
                  {lead.name}
                </h3>
                <StatusBadge status={lead.status} />
                <PriorityBadge score={lead.priority_score} />
                <SourceBadge source={lead.source} />
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  <a 
                    href={`mailto:${lead.email}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors flex items-center gap-1 group"
                  >
                    {lead.email}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
                {lead.company_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    <span>{lead.company_name}</span>
                  </div>
                )}
                {lead.phone_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    <span>{lead.phone_number}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {format(new Date(lead.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          {/* Role and Message Preview */}
          {(lead.role || lead.message) && (
            <div className="space-y-2">
              {lead.role && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Role:</span> {lead.role}
                </div>
              )}
              {lead.message && (
                <div className="text-xs">
                  <span className="font-medium text-muted-foreground">Message:</span>
                  <p className="text-foreground mt-1 line-clamp-2">
                    {lead.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Mapping Info */}
          {lead.mapped_to_listing_id && (
            <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
              <div className="flex items-center gap-2 text-xs">
                <MapPin className="h-3 w-3 text-primary" />
                <span className="text-primary font-medium">Mapped to:</span>
                <span className="text-foreground">{lead.mapped_to_listing_title}</span>
              </div>
              {lead.mapped_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(lead.mapped_at), 'MMM d, yyyy h:mm a')}
                </div>
              )}
            </div>
          )}

          {/* Conversion Info */}
          {lead.converted_to_request_id && (
            <div className="bg-success/5 border border-success/20 rounded-md p-3">
              <div className="flex items-center gap-2 text-xs">
                <Check className="h-3 w-3 text-success" />
                <span className="text-success font-medium">Converted to connection request</span>
              </div>
              {lead.converted_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(lead.converted_at), 'MMM d, yyyy h:mm a')}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {lead.status !== 'archived' && (
            <div className="flex gap-2 pt-2 border-t border-border/40">
              {lead.status === 'pending' && (
                <Button
                  size="sm"
                  onClick={() => onMapToListing(lead)}
                  className="flex items-center gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  Map to Listing
                </Button>
              )}
              
              {lead.status === 'mapped' && (
                <Button
                  size="sm"
                  onClick={() => onConvertToRequest(lead.id)}
                  className="flex items-center gap-1"
                >
                  <ArrowRight className="h-3 w-3" />
                  Convert to Request
                </Button>
              )}
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => onArchive(lead.id)}
                className="flex items-center gap-1"
              >
                <Archive className="h-3 w-3" />
                Archive
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

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
  
  const { mutate: createLead, isPending: isCreating } = useCreateInboundLead();
  const { mutate: mapLeadToListing, isPending: isMapping } = useMapLeadToListing();

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

  const handleBulkCreate = async (leadsData: any[]) => {
    // Create leads one by one for better error handling
    for (const leadData of leadsData) {
      try {
        await new Promise((resolve, reject) => {
          createLead(leadData, {
            onSuccess: resolve,
            onError: reject
          });
        });
      } catch (error) {
        console.error('Error creating lead:', error);
      }
    }
    
    toast({
      title: "Bulk import completed",
      description: `Successfully imported ${leadsData.length} leads`,
    });
  };

  if (isLoading) {
    return <InboundLeadsTableSkeleton />;
  }

  if (leads.length === 0) {
    return (
      <div className="space-y-4">
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Single Lead
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsBulkImportDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Bulk Import (CSV)
          </Button>
        </div>
        
        <InboundLeadsTableEmpty />
        
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Single Lead
        </Button>
        <Button 
          variant="outline"
          onClick={() => setIsBulkImportDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Bulk Import (CSV)
        </Button>
      </div>

      {/* Leads List */}
      <div className="space-y-4">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onMapToListing={handleMapToListing}
            onConvertToRequest={onConvertToRequest}
            onArchive={onArchive}
          />
        ))}
      </div>
      
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
        isLoading={isMapping}
        lead={selectedLead}
      />
      
      <DuplicateWarningDialog
        isOpen={isDuplicateWarningOpen}
        onClose={() => {
          setIsDuplicateWarningOpen(false);
          setSelectedLead(null);
          setPendingMappingData(null);
          setDuplicateResult(null);
        }}
        onProceed={handleProceedWithMapping}
        onMerge={handleMergeWithExisting}
        duplicateResult={duplicateResult}
        leadEmail={selectedLead?.email || ''}
        leadCompany={selectedLead?.company_name || ''}
        listingTitle={pendingMappingData?.listingTitle || ''}
      />
    </div>
  );
};