import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

interface RequestsGridViewProps {
  requests: AdminConnectionRequest[];
  selectedListing: { id: string; title: string } | null;
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
}

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
  request, 
  onApprove, 
  onReject 
}: { 
  request: AdminConnectionRequest;
  onApprove: (request: AdminConnectionRequest) => void;
  onReject: (request: AdminConnectionRequest) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

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

        {/* Actions */}
        {request.status === 'pending' && (
          <div className="flex gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApprove(request)}
              className="flex-1 text-xs h-7 border-success/30 text-success hover:bg-success/10"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReject(request)}
              className="flex-1 text-xs h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export function RequestsGridView({ requests, selectedListing, onApprove, onReject }: RequestsGridViewProps) {
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
              ? `No connection requests found for "${selectedListing.title}"`
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
              <h2 className="font-semibold text-lg">{selectedListing.title}</h2>
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
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </div>
    </div>
  );
}