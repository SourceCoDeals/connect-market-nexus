
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AdminConnectionRequest } from '@/types/admin';

interface ConnectionRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  selectedRequest: AdminConnectionRequest | null;
  actionType: 'approve' | 'reject' | null;
  isLoading: boolean;
}

export const ConnectionRequestDialog = ({
  isOpen,
  onClose,
  onConfirm,
  selectedRequest,
  actionType,
  isLoading,
}: ConnectionRequestDialogProps) => {
  const [adminComment, setAdminComment] = useState('');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {actionType === "approve"
              ? "Approve Connection Request"
              : "Reject Connection Request"}
          </DialogTitle>
          <DialogDescription>
            {actionType === "approve"
              ? "Approving this request will connect the buyer with the listing owner."
              : "Rejecting this request will deny the buyer access to the listing owner."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-1 gap-2">
            <p className="text-sm font-medium">Buyer:</p>
            <p className="text-sm">
              {selectedRequest?.user
                ? `${selectedRequest.user.first_name} ${selectedRequest.user.last_name} (${selectedRequest.user.email})`
                : "Unknown User"}
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <p className="text-sm font-medium">Company:</p>
            <p className="text-sm">{selectedRequest?.user?.company || "No company"}</p>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <p className="text-sm font-medium">Listing:</p>
            <p className="text-sm">{selectedRequest?.listing?.title || "Unknown Listing"}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="adminComment">Admin Comment (optional)</Label>
            <Textarea
              id="adminComment"
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder="Add an internal note about this decision..."
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(adminComment)}
            disabled={isLoading}
            className={
              actionType === "approve"
                ? "bg-green-500 hover:bg-green-600"
                : "bg-red-500 hover:bg-red-600"
            }
          >
            {isLoading
              ? "Processing..."
              : actionType === "approve"
              ? "Approve Request"
              : "Reject Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
