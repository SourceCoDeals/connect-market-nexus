import { AdminConnectionRequest } from "@/types/admin";
import { Building } from "lucide-react";

interface BuyerDealsOverviewProps {
  requests: AdminConnectionRequest[];
  currentRequestId?: string;
}

export function BuyerDealsOverview({ requests, currentRequestId }: BuyerDealsOverviewProps) {
  if (requests.length <= 1) {
    return null;
  }

  const otherRequests = requests.filter(req => req.id !== currentRequestId);

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'approved':
        return <div className="w-1.5 h-1.5 rounded-full bg-green-500" />;
      case 'rejected':
        return <div className="w-1.5 h-1.5 rounded-full bg-red-500" />;
      default:
        return <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />;
    }
  };

  return (
    <div className="border border-border/20 rounded-lg bg-background/50">
      <div className="p-3 border-b border-border/10">
        <h6 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          Other Active Interests ({otherRequests.length})
        </h6>
      </div>
      <div className="max-h-48 overflow-y-auto">
        <div className="divide-y divide-border/10">
          {otherRequests.map((request) => (
            <div key={request.id} className="p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-medium text-xs text-foreground leading-relaxed flex-1">
                  {request.listing?.title || 'Unknown Listing'}
                </h4>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 shrink-0">
                  {getStatusIndicator(request.status)}
                  <span className="capitalize">{request.status}</span>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground/60">
                ${request.listing?.revenue?.toLocaleString() || 'N/A'} • {request.listing?.location || 'N/A'}
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-xs text-muted-foreground/50 bg-muted/20 px-3 py-2 border-t border-border/10">
          Follow-up actions apply to all active requests
        </div>
      </div>
    </div>
  );
}