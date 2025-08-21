import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  User, 
  Building2, 
  Mail, 
  Phone,
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import { AdminConnectionRequest } from "@/types/admin";
import { useUpdateConnectionRequestStatus } from "@/hooks/admin/use-connection-request-status";
import { useAuth } from "@/context/AuthContext";
import { getAdminProfile } from "@/lib/admin-profiles";

interface RequestsGridViewProps {
  requests: AdminConnectionRequest[];
  selectedListing: { id: string; title: string; internal_company_name?: string | null } | null;
}

// Helper function to format listing display name for buyer cards (Title/Company Name)
const formatListingForBuyerCard = (title: string, companyName?: string | null): string => {
  if (companyName && companyName.trim()) {
    return `${title}/${companyName}`;
  }
  return title;
};

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          className: 'bg-success/10 text-success border-success/20',
          icon: <CheckCircle className="h-3 w-3 mr-1" />
        };
      case 'rejected':
        return {
          className: 'bg-destructive/10 text-destructive border-destructive/20',
          icon: <XCircle className="h-3 w-3 mr-1" />
        };
      case 'on_hold':
        return {
          className: 'bg-warning/10 text-warning border-warning/20',
          icon: <AlertTriangle className="h-3 w-3 mr-1" />
        };
      default:
        return {
          className: 'bg-muted/50 text-muted-foreground border-border',
          icon: <Clock className="h-3 w-3 mr-1" />
        };
    }
  };

  const config = getStatusConfig(status);
  const displayText = status === 'on_hold' ? 'On Hold' : 
                     status.charAt(0).toUpperCase() + status.slice(1);
  
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.icon}
      {displayText}
    </Badge>
  );
};

const BuyerCard = ({ 
  request
}: { 
  request: AdminConnectionRequest;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { user } = useAuth();
  const updateStatus = useUpdateConnectionRequestStatus();

  return (
    <Card className="h-full border border-border/50 hover:border-border transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">
                {request.user?.first_name} {request.user?.last_name}
              </h3>
              <StatusBadge status={request.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(request.created_at), 'MMM d, yyyy')}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {/* Listing Info */}
        {request.listing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">
              {formatListingForBuyerCard(request.listing.title, request.listing.internal_company_name)}
            </span>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">{request.user?.email}</span>
          </div>
          {request.user?.company && (
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{request.user.company}</span>
            </div>
          )}
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            {request.user_message && (
              <div className="text-xs">
                <div className="font-medium text-muted-foreground mb-1">Message:</div>
                <div className="bg-muted/50 rounded p-2 text-xs">
                  {request.user_message}
                </div>
              </div>
            )}
            
            {request.admin_comment && (
              <div className="text-xs">
                <div className="font-medium text-muted-foreground mb-1">Admin Note:</div>
                <div className="bg-success/10 border border-success/20 rounded p-2 text-xs">
                  {request.admin_comment}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Toggles */}
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="text-xs font-medium text-muted-foreground">Status Controls</div>
          
          <div className="space-y-3">
            {/* Approved Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor={`approved-${request.id}`} className="text-xs text-success">
                Approved
              </Label>
              <Switch
                id={`approved-${request.id}`}
                checked={request.status === 'approved'}
                onCheckedChange={(checked) => {
                  updateStatus.mutate({
                    requestId: request.id,
                    status: checked ? 'approved' : 'pending'
                  });
                }}
                disabled={updateStatus.isPending}
              />
            </div>

            {/* Rejected Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor={`rejected-${request.id}`} className="text-xs text-destructive">
                Rejected
              </Label>
              <Switch
                id={`rejected-${request.id}`}
                checked={request.status === 'rejected'}
                onCheckedChange={(checked) => {
                  updateStatus.mutate({
                    requestId: request.id,
                    status: checked ? 'rejected' : 'pending'
                  });
                }}
                disabled={updateStatus.isPending}
              />
            </div>

            {/* On Hold Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor={`on_hold-${request.id}`} className="text-xs text-warning">
                On Hold
              </Label>
              <Switch
                id={`on_hold-${request.id}`}
                checked={request.status === 'on_hold'}
                onCheckedChange={(checked) => {
                  updateStatus.mutate({
                    requestId: request.id,
                    status: checked ? 'on_hold' : 'pending'
                  });
                }}
                disabled={updateStatus.isPending}
              />
            </div>
          </div>

          {/* Admin Decision Info */}
          {request.status !== 'pending' && (
            <div className="text-xs space-y-1 pt-2 border-t border-border/50">
              <div className="font-medium text-muted-foreground">Decision Details:</div>
              {request.status === 'approved' && (
                <div className="text-success">
                  Approved by {request.approved_by ? (getAdminProfile(request.approved_by)?.name || `Admin (${request.approved_by})`) : 'Admin'} 
                  {request.approved_at && ` on ${format(new Date(request.approved_at), 'MMM d, yyyy')}`}
                </div>
              )}
              {request.status === 'rejected' && (
                <div className="text-destructive">
                  Rejected by {request.rejected_by ? (getAdminProfile(request.rejected_by)?.name || `Admin (${request.rejected_by})`) : 'Admin'}
                  {request.rejected_at && ` on ${format(new Date(request.rejected_at), 'MMM d, yyyy')}`}
                </div>
              )}
              {request.status === 'on_hold' && (
                <div className="text-warning">
                  Put on hold by {request.on_hold_by ? (getAdminProfile(request.on_hold_by)?.name || `Admin (${request.on_hold_by})`) : 'Admin'}
                  {request.on_hold_at && ` on ${format(new Date(request.on_hold_at), 'MMM d, yyyy')}`}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export function RequestsGridView({ requests, selectedListing }: RequestsGridViewProps) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <User className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground mb-2">
            No buyers found
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            {selectedListing 
              ? `No connection requests found for "${formatListingForBuyerCard(selectedListing.title, selectedListing.internal_company_name)}"`
              : "No connection requests match your search criteria"
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {selectedListing && (
        <div className="bg-card/30 backdrop-blur-sm rounded-xl border border-border/50 p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-lg">{formatListingForBuyerCard(selectedListing.title, selectedListing.internal_company_name)}</h2>
              <p className="text-sm text-muted-foreground">
                {requests.length} buyer{requests.length !== 1 ? 's' : ''} interested in this deal
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Buyers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {requests.map((request) => (
          <BuyerCard
            key={request.id}
            request={request}
          />
        ))}
      </div>
    </div>
  );
}