
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
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Request Connection</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
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
              placeholder="e.g., I have an existing platform and this looks like it could be a good add-on, or I'm actively searching for businesses in this sector..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full resize-none"
              required
              minLength={20}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-muted-foreground">
                Providing context helps business owners understand your interest and relevance.
              </p>
              <p className="text-xs text-muted-foreground">
                {message.length}/500 characters (min 20)
              </p>
            </div>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>What happens next:</strong> We'll review your request based on your profile and the business owner's criteria. You'll receive a response with further details shortly.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !message.trim() || message.length < 20}
            className="w-full sm:w-auto bg-gradient-to-r from-[#D7B65C] via-[#E5C76A] to-[#D7B65C] text-slate-900 border-0 hover:shadow-lg hover:shadow-[rgba(215,182,92,0.2)] font-semibold"
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectionRequestDialog;
