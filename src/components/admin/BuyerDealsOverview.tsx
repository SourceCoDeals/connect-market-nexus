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
    <div className="border rounded-lg">
      <div className="p-3 border-b">
        <h6 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Building className="h-4 w-4" />
          Other Active Interests ({otherRequests.length})
        </h6>
      </div>
      <div className="max-h-48 overflow-y-auto">
        <div className="divide-y">
          {otherRequests.map((request, index) => (
            <div key={request.id} className="p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="font-medium text-xs text-foreground truncate">
                  {request.listing?.title || 'Unknown Listing'}
                </h4>
                <Badge 
                  variant="outline" 
                  className={`text-xs shrink-0 ${getStatusColor(request.status)}`}
                >
                  {getStatusIcon(request.status)}
                  {request.status}
                </Badge>
              </div>
              
              <div className="text-xs text-muted-foreground">
                ${request.listing?.revenue?.toLocaleString() || 'N/A'} • {request.listing?.location || 'N/A'}
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 border-t">
          💡 Follow-up actions will apply to all active requests from this buyer
        </div>
      </div>
    </div>
  );
}