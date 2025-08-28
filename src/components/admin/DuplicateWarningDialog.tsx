import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, Mail, Building2 } from "lucide-react";
import { DuplicateCheckResult } from "@/hooks/admin/use-inbound-leads";

interface DuplicateWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  onMerge: (requestId: string) => void;
  duplicateResult: DuplicateCheckResult | null;
  leadEmail: string;
  leadCompany: string;
  listingTitle: string;
}

export const DuplicateWarningDialog = ({
  isOpen,
  onClose,
  onProceed,
  onMerge,
  duplicateResult,
  leadEmail,
  leadCompany,
  listingTitle
}: DuplicateWarningDialogProps) => {
  if (!duplicateResult?.hasDuplicates) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Potential Duplicates Detected
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-foreground">
              We found potential duplicates for this lead when mapping to <strong>{listingTitle}</strong>:
            </p>
          </div>

          {duplicateResult.exactDuplicate && (
            <div className="space-y-3">
              <h4 className="font-semibold text-destructive flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Exact Email Match
              </h4>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{duplicateResult.exactDuplicate.userEmail}</p>
                    <p className="text-xs text-muted-foreground">This email already has a connection request for this listing</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMerge(duplicateResult.exactDuplicate!.requestId)}
                  >
                    View Request
                  </Button>
                </div>
              </div>
            </div>
          )}

          {duplicateResult.sameFirmRequests && duplicateResult.sameFirmRequests.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-warning flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Same Company/Domain ({duplicateResult.sameFirmRequests.length})
              </h4>
              <div className="space-y-2">
                {duplicateResult.sameFirmRequests.map((request, index) => (
                  <div key={index} className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{request.userEmail}</p>
                        <p className="text-xs text-muted-foreground">{request.companyName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Same Firm</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMerge(request.requestId)}
                        >
                          Merge as Contact
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg">
            <h5 className="font-medium text-sm mb-2">Lead Information:</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Email:</span> {leadEmail}
              </div>
              <div>
                <span className="text-muted-foreground">Company:</span> {leadCompany || 'Not provided'}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel Mapping
          </Button>
          <Button 
            onClick={onProceed}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Create New Request Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};