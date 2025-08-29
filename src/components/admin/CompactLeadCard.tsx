import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from "lucide-react";
import { InboundLead } from "@/hooks/admin/use-inbound-leads";

interface CompactLeadCardProps {
  lead: InboundLead;
  isSelected?: boolean;
  onSelectionChange?: (leadId: string, selected: boolean) => void;
  onMapToListing: (lead: InboundLead) => void;
  onConvertToRequest: (leadId: string) => void;
  onArchive: (leadId: string) => void;
  showCheckbox?: boolean;
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'mapped':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'converted':
        return 'bg-success/10 text-success border-success/20';
      case 'archived':
        return 'bg-muted/50 text-muted-foreground border-border';
      default:
        return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  return (
    <Badge variant="outline" className={`text-xs ${getStatusConfig(status)}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

const PriorityBadge = ({ score }: { score: number }) => {
  const getPriorityConfig = (score: number) => {
    if (score >= 8) {
      return { label: 'High', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    } else if (score >= 6) {
      return { label: 'Med', className: 'bg-warning/10 text-warning border-warning/20' };
    } else {
      return { label: 'Low', className: 'bg-muted/50 text-muted-foreground border-border' };
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
    webflow: 'Web',
    website: 'Site',
    referral: 'Ref',
    cold_outreach: 'Cold',
    networking: 'Net',
    linkedin: 'LI',
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

export const CompactLeadCard = ({ 
  lead, 
  isSelected = false,
  onSelectionChange,
  onMapToListing, 
  onConvertToRequest, 
  onArchive,
  showCheckbox = false
}: CompactLeadCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={`border transition-all duration-200 ${
      isSelected ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'
    }`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="flex items-center gap-3">
            {/* Checkbox */}
            {showCheckbox && onSelectionChange && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange(lead.id, !!checked)}
                className="mt-1"
              />
            )}
            
            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sm truncate">{lead.name}</h3>
                {lead.is_duplicate && (
                  <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{lead.email}</span>
              </div>
              {lead.company_name && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{lead.company_name}</span>
                </div>
              )}
            </div>
            
            {/* Badges */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <StatusBadge status={lead.status} />
              <PriorityBadge score={lead.priority_score} />
              <SourceBadge source={lead.source} />
            </div>
            
            {/* Date */}
            <div className="text-xs text-muted-foreground flex-shrink-0">
              {format(new Date(lead.created_at), 'MMM d')}
            </div>
            
            {/* Expand Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0 flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>

          {/* Actions Row */}
          {lead.status !== 'archived' && (
            <div className="flex gap-2">
              {lead.status === 'pending' && (
                <Button
                  size="sm"
                  onClick={() => onMapToListing(lead)}
                  className="h-7 text-xs flex items-center gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  Map
                </Button>
              )}
              
              {lead.status === 'mapped' && (
                <Button
                  size="sm"
                  onClick={() => onConvertToRequest(lead.id)}
                  className="h-7 text-xs flex items-center gap-1"
                >
                  <ArrowRight className="h-3 w-3" />
                  Convert
                </Button>
              )}
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => onArchive(lead.id)}
                className="h-7 text-xs flex items-center gap-1"
              >
                <Archive className="h-3 w-3" />
                Archive
              </Button>
            </div>
          )}

          {/* Expanded Details */}
          {isExpanded && (
            <div className="space-y-2 border-t border-border/40 pt-3">
              {/* Role and Phone */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                {lead.role && (
                  <div>
                    <span className="font-medium text-muted-foreground">Role:</span>
                    <p className="text-foreground mt-1">{lead.role}</p>
                  </div>
                )}
                {lead.phone_number && (
                  <div>
                    <span className="font-medium text-muted-foreground">Phone:</span>
                    <p className="text-foreground mt-1">{lead.phone_number}</p>
                  </div>
                )}
              </div>
              
              {/* Message */}
              {lead.message && (
                <div className="text-xs">
                  <span className="font-medium text-muted-foreground">Message:</span>
                  <p className="text-foreground mt-1 break-words">{lead.message}</p>
                </div>
              )}
              
              {/* Duplicate Warning */}
              {lead.is_duplicate && lead.duplicate_info && (
                <div className="bg-warning/10 border border-warning/20 rounded-md p-2">
                  <div className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-warning font-medium">Duplicate:</span>
                      <span className="text-foreground ml-1">{lead.duplicate_info}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Mapping Info */}
              {lead.mapped_to_listing_id && (
                <div className="bg-primary/5 border border-primary/20 rounded-md p-2">
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
                <div className="bg-success/5 border border-success/20 rounded-md p-2">
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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};