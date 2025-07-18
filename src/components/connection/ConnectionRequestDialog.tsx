
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConnectionRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
  isSubmitting: boolean;
  listingTitle?: string;
}

const ConnectionRequestDialog = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  listingTitle
}: ConnectionRequestDialogProps) => {
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit(message);
      setMessage("");
    }
  };

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Connection</DialogTitle>
          <DialogDescription>
            {listingTitle && (
              <>Tell us why you're interested in <strong>{listingTitle}</strong>.</>
            )}
            {!listingTitle && "Tell us why you're interested in this business."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="message" className="block text-sm font-medium mb-2">
              Your message *
            </label>
            <Textarea
              id="message"
              placeholder="e.g., I have an existing platform and this looks like it could be a good add-on..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Providing context helps business owners understand your interest and relevance.
            </p>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>What happens next:</strong> We'll review your request based on your profile and the business owner's criteria. You'll receive a response with further details shortly.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isSubmitting}
            className="bg-slate-900 text-white hover:bg-slate-800 border-slate-900"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !message.trim()}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectionRequestDialog;
