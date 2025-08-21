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
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
          <Building className="h-4 w-4" />
          Other Active Interests ({otherRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {otherRequests.map((request) => (
          <div 
            key={request.id}
            className="flex items-start gap-3 p-3 bg-white border border-blue-100 rounded-lg hover:border-blue-200 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-sm text-foreground truncate">
                  {request.listing?.title || 'Unknown Listing'}
                </h4>
                <Badge 
                  variant="outline" 
                  className={`text-xs flex items-center gap-1 ${getStatusColor(request.status)}`}
                >
                  {getStatusIcon(request.status)}
                  {request.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-1">
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${request.listing?.revenue?.toLocaleString() || 'N/A'}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {request.listing?.location || 'N/A'}
                </div>
              </div>
              
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
              </div>
            </div>
          </div>
        ))}
        
        <div className="text-xs text-blue-700 bg-blue-100 px-3 py-2 rounded-lg">
          💡 Follow-up actions will apply to all active requests from this buyer
        </div>
      </CardContent>
    </Card>
  );
}