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
  MapPin,
  Archive,
  ArrowRight,
  Check,
  AlertTriangle,
  MoreHorizontal
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
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
      case 'converted':
        return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
      case 'archived':
        return 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={`text-xs font-medium px-2 py-1 transition-colors ${getStatusConfig(status)}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

const PriorityBadge = ({ score }: { score: number }) => {
  const getPriorityConfig = (score: number) => {
    if (score >= 8) {
      return { 
        label: 'High', 
        className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
      };
    } else if (score >= 6) {
      return { 
        label: 'Medium', 
        className: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' 
      };
    } else {
      return { 
        label: 'Low', 
        className: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100' 
      };
    }
  };

  const config = getPriorityConfig(score);
  return (
    <Badge 
      variant="outline" 
      className={`text-xs font-medium px-2 py-1 transition-colors ${config.className}`}
    >
      {config.label}
    </Badge>
  );
};

const SourceBadge = ({ source }: { source: string }) => {
  const labelMap: Record<string, string> = {
    webflow: 'Webflow',
    website: 'Website',
    referral: 'Referral',
    cold_outreach: 'Cold',
    networking: 'Network',
    linkedin: 'LinkedIn',
    email: 'Email',
    manual: 'Manual',
  };
  const label = labelMap[source] || 'Manual';
  return (
    <Badge 
      variant="outline" 
      className="text-xs font-medium px-2 py-1 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors"
    >
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
  const [showActions, setShowActions] = useState(false);

  return (
    <Card 
      className={`group transition-all duration-200 hover:shadow-md border ${
        isSelected 
          ? 'border-blue-300 bg-blue-50/50 shadow-sm' 
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Checkbox */}
              {showCheckbox && onSelectionChange && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectionChange(lead.id, !!checked)}
                  className="mt-0.5 border-gray-300"
                />
              )}
              
              {/* Main Content */}
              <div className="flex-1 min-w-0">
                {/* Name and Company */}
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">
                    {lead.name}
                  </h3>
                  {lead.is_duplicate && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                
                {/* Email */}
                <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
                
                {/* Company and Role */}
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  {lead.company_name && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{lead.company_name}</span>
                    </div>
                  )}
                  {lead.role && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{lead.role}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Date */}
            <div className="text-xs text-gray-500 font-medium flex-shrink-0">
              {format(new Date(lead.created_at), 'MMM d')}
            </div>
          </div>

          {/* Badges Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={lead.status} />
            <PriorityBadge score={lead.priority_score} />
            <SourceBadge source={lead.source} />
          </div>

          {/* Message Preview */}
          {lead.message && (
            <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
              <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                {lead.message}
              </p>
            </div>
          )}

          {/* Mapping Info */}
          {lead.mapped_to_listing_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-xs">
                <MapPin className="h-3 w-3 text-blue-600" />
                <span className="text-blue-700 font-medium">Mapped to:</span>
                <span className="text-blue-800 truncate">{lead.mapped_to_listing_title}</span>
              </div>
            </div>
          )}

          {/* Duplicate Warning */}
          {lead.is_duplicate && lead.duplicate_info && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <div className="flex items-start gap-1.5 text-xs">
                <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-amber-700 font-medium">Duplicate: </span>
                  <span className="text-amber-800">{lead.duplicate_info}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions Row */}
          {lead.status !== 'archived' && (
            <div className={`flex items-center justify-between transition-opacity duration-200 ${
              showActions || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              <div className="flex gap-2">
                {lead.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => onMapToListing(lead)}
                    className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white border-0"
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    Map to Listing
                  </Button>
                )}
                
                {lead.status === 'mapped' && (
                  <Button
                    size="sm"
                    onClick={() => onConvertToRequest(lead.id)}
                    className="h-7 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    Convert
                  </Button>
                )}
              </div>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onArchive(lead.id)}
                className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};