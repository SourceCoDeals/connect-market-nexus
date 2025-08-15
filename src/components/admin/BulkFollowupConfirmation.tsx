import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AdminConnectionRequest } from "@/types/admin";
import { AlertCircle, Users } from "lucide-react";

interface BulkFollowupConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: AdminConnectionRequest[];
  followupType: 'positive' | 'negative';
  onConfirm: (excludedRequestIds: string[]) => void;
  isLoading?: boolean;
}

export function BulkFollowupConfirmation({
  open,
  onOpenChange,
  requests,
  followupType,
  onConfirm,
  isLoading = false
}: BulkFollowupConfirmationProps) {
  const [excludedRequestIds, setExcludedRequestIds] = useState<string[]>([]);

  const handleRequestToggle = (requestId: string, exclude: boolean) => {
    if (exclude) {
      setExcludedRequestIds(prev => [...prev, requestId]);
    } else {
      setExcludedRequestIds(prev => prev.filter(id => id !== requestId));
    }
  };

  const handleConfirm = () => {
    onConfirm(excludedRequestIds);
    setExcludedRequestIds([]);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setExcludedRequestIds([]);
  };

  const includedCount = requests.length - excludedRequestIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {followupType === 'positive' ? 'Follow-Up' : 'Rejection Notice'} Confirmation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">
                Update across multiple connection requests
              </p>
              <p className="text-blue-700">
                The {followupType === 'positive' ? 'follow-up' : 'rejection notice'} status will be updated across {includedCount} active connection request{includedCount !== 1 ? 's' : ''} from this buyer.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-foreground">
              Connection Requests ({requests.length} total)
            </h4>
            
            {requests.map((request) => {
              const isExcluded = excludedRequestIds.includes(request.id);
              
              return (
                <div 
                  key={request.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                    isExcluded 
                      ? 'bg-gray-50 border-gray-200' 
                      : 'bg-white border-border hover:bg-gray-50'
                  }`}
                >
                  <Checkbox
                    id={`exclude-${request.id}`}
                    checked={!isExcluded}
                    onCheckedChange={(checked) => handleRequestToggle(request.id, !checked)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className={`font-medium text-sm truncate ${
                        isExcluded ? 'text-gray-500' : 'text-foreground'
                      }`}>
                        {request.listing?.title || 'Unknown Listing'}
                      </h5>
                      <Badge variant="outline" className="text-xs">
                        {request.listing?.category || 'N/A'}
                      </Badge>
                    </div>
                    
                    <p className={`text-xs ${
                      isExcluded ? 'text-gray-400' : 'text-muted-foreground'
                    }`}>
                      Revenue: ${request.listing?.revenue?.toLocaleString() || 'N/A'} • 
                      Location: {request.listing?.location || 'N/A'}
                    </p>
                    
                    {isExcluded && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        Will be excluded from bulk update
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isLoading || includedCount === 0}
            className={followupType === 'negative' ? 'bg-amber-600 hover:bg-amber-700' : ''}
          >
            {isLoading ? 'Updating...' : `Update ${includedCount} Request${includedCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}