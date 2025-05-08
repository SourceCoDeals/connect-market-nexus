
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
import { User } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatDistanceToNow } from 'date-fns';

interface UserDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  selectedUser: User | null;
  actionType: 'approve' | 'reject' | 'makeAdmin' | 'revokeAdmin' | null;
  isLoading: boolean;
}

export const UserDetailDialog = ({
  isOpen,
  onClose,
  onConfirm,
  selectedUser,
  actionType,
  isLoading,
}: UserDetailDialogProps) => {
  const [reason, setReason] = useState('');

  const getActionTitle = () => {
    switch (actionType) {
      case 'approve':
        return 'Approve User';
      case 'reject':
        return 'Reject User';
      case 'makeAdmin':
        return 'Make User an Admin';
      case 'revokeAdmin':
        return 'Remove Admin Privileges';
      default:
        return 'User Details';
    }
  };

  const getActionDescription = () => {
    switch (actionType) {
      case 'approve':
        return 'Approving this user will grant them access to the marketplace.';
      case 'reject':
        return 'Rejecting this user will deny them access to the marketplace.';
      case 'makeAdmin':
        return 'This will grant the user admin privileges, allowing them to manage users, listings, and requests.';
      case 'revokeAdmin':
        return 'This will remove admin privileges from the user.';
      default:
        return '';
    }
  };

  const getButtonText = () => {
    if (isLoading) return 'Processing...';
    
    switch (actionType) {
      case 'approve':
        return 'Approve User';
      case 'reject':
        return 'Reject User';
      case 'makeAdmin':
        return 'Make Admin';
      case 'revokeAdmin':
        return 'Revoke Admin';
      default:
        return 'Confirm';
    }
  };

  const getButtonColor = () => {
    switch (actionType) {
      case 'approve':
        return 'bg-green-500 hover:bg-green-600';
      case 'reject':
        return 'bg-red-500 hover:bg-red-600';
      case 'makeAdmin':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'revokeAdmin':
        return 'bg-gray-500 hover:bg-gray-600';
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{getActionTitle()}</DialogTitle>
          <DialogDescription>{getActionDescription()}</DialogDescription>
        </DialogHeader>
        
        {selectedUser && (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Name</Label>
                <p className="text-sm mt-1">{selectedUser.first_name} {selectedUser.last_name}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <p className="text-sm mt-1">{selectedUser.email}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Company</Label>
                <p className="text-sm mt-1">{selectedUser.company || "Not specified"}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Phone</Label>
                <p className="text-sm mt-1">{selectedUser.phone_number || "Not specified"}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Website</Label>
                <p className="text-sm mt-1">
                  {selectedUser.website ? (
                    <a 
                      href={selectedUser.website.startsWith('http') ? selectedUser.website : `https://${selectedUser.website}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {selectedUser.website}
                    </a>
                  ) : (
                    "Not specified"
                  )}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Registered</Label>
                <p className="text-sm mt-1">
                  {selectedUser.created_at ? 
                    formatDistanceToNow(new Date(selectedUser.created_at), { addSuffix: true }) : 
                    "Unknown"
                  }
                </p>
              </div>
            </div>
            
            <Accordion type="single" collapsible>
              <AccordionItem value="additional-info">
                <AccordionTrigger>Additional Information</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Buyer Type</Label>
                      <p className="text-sm mt-1">{selectedUser.buyer_type || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Fund Size</Label>
                      <p className="text-sm mt-1">{selectedUser.fund_size || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">AUM</Label>
                      <p className="text-sm mt-1">{selectedUser.aum || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Est. Revenue</Label>
                      <p className="text-sm mt-1">{selectedUser.estimated_revenue || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Investment Size</Label>
                      <p className="text-sm mt-1">{selectedUser.investment_size || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Is Funded</Label>
                      <p className="text-sm mt-1">{selectedUser.is_funded || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Funded By</Label>
                      <p className="text-sm mt-1">{selectedUser.funded_by || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Target Company Size</Label>
                      <p className="text-sm mt-1">{selectedUser.target_company_size || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Funding Source</Label>
                      <p className="text-sm mt-1">{selectedUser.funding_source || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Needs Loan</Label>
                      <p className="text-sm mt-1">{selectedUser.needs_loan || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Ideal Target</Label>
                      <p className="text-sm mt-1">{selectedUser.ideal_target || "Not specified"}</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            {/* Show rejection reason field only for reject action */}
            {actionType === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Rejection Reason</Label>
                <Textarea
                  id="rejectionReason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a reason for rejecting this user..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">This reason will be included in the rejection email sent to the user.</p>
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(reason)}
            disabled={isLoading}
            className={getButtonColor()}
          >
            {getButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
