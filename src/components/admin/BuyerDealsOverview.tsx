import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminConnectionRequest } from "@/types/admin";
import { Building, DollarSign, MapPin, Clock, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

interface BuyerDealsOverviewProps {
  requests: AdminConnectionRequest[];
  currentRequestId?: string;
}

export function BuyerDealsOverview({ requests, currentRequestId }: BuyerDealsOverviewProps) {
  if (requests.length <= 1) {
    return null;
  }

  const otherRequests = requests.filter(req => req.id !== currentRequestId);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-amber-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="border border-border/30 rounded-lg p-3">
      <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
        <Building className="h-3 w-3" />
        Other Active Interests ({otherRequests.length})
      </h5>
      <div className="space-y-2">
        {otherRequests.map((request) => (
          <div 
            key={request.id}
            className="flex items-center justify-between p-2 bg-muted/30 rounded hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium truncate">
                  {request.listing?.title || 'Unknown Listing'}
                </span>
                <Badge 
                  variant="outline" 
                  className="text-xs h-4 px-1"
                >
                  {getStatusIcon(request.status)}
                  {request.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>${request.listing?.revenue?.toLocaleString() || 'N/A'}</span>
                <span>{request.listing?.location || 'N/A'}</span>
                <span>{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        ))}
        
        <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/20 rounded mt-2">
          💡 Follow-up actions apply to all requests
        </div>
      </div>
    </div>
  );
}