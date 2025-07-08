
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Clock, CheckCircle, XCircle } from "lucide-react";
import ConnectionRequestDialog from "@/components/connection/ConnectionRequestDialog";

interface ConnectionButtonProps {
  connectionExists: boolean;
  connectionStatus: string;
  isRequesting: boolean;
  isAdmin: boolean;
  handleRequestConnection: (message?: string) => void;
  listingTitle?: string;
}

const ConnectionButton = ({
  connectionExists,
  connectionStatus,
  isRequesting,
  isAdmin,
  handleRequestConnection,
  listingTitle
}: ConnectionButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDialogSubmit = (message: string) => {
    handleRequestConnection(message);
    setIsDialogOpen(false);
  };

  const handleButtonClick = () => {
    if (connectionExists && connectionStatus === "rejected") {
      // For rejected requests, open dialog for resubmission
      setIsDialogOpen(true);
    } else if (!connectionExists) {
      // For new requests, open dialog
      setIsDialogOpen(true);
    }
  };
  
  if (connectionExists) {
    if (connectionStatus === "pending") {
      return (
        <Button
          variant="secondary"
          className="w-full md:w-auto"
          disabled={true}
        >
          <Clock className="mr-2 h-4 w-4" /> Request Pending
        </Button>
      );
    } else if (connectionStatus === "approved") {
      return (
        <Button
          variant="default"
          className="w-full md:w-auto bg-green-600 hover:bg-green-700"
          disabled={true}
        >
          <CheckCircle className="mr-2 h-4 w-4" /> Connected
        </Button>
      );
    } else if (connectionStatus === "rejected") {
      return (
        <>
          <Button
            variant="outline"
            className="w-full md:w-auto text-red-600 border-red-200"
            onClick={handleButtonClick}
            disabled={isRequesting}
          >
            <XCircle className="mr-2 h-4 w-4" /> Rejected - Resubmit
          </Button>
          <ConnectionRequestDialog
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onSubmit={handleDialogSubmit}
            isSubmitting={isRequesting}
            listingTitle={listingTitle}
          />
        </>
      );
    }
  }
  
  // Default state - no connection request exists
  return (
    <>
      <Button
        variant="default"
        className="w-full md:w-auto"
        disabled={isRequesting}
        onClick={handleButtonClick}
      >
        {isRequesting ? (
          <>
            <Clock className="mr-2 h-4 w-4 animate-spin" /> Submitting...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" /> Request Connection
          </>
        )}
      </Button>
      <ConnectionRequestDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        isSubmitting={isRequesting}
        listingTitle={listingTitle}
      />
    </>
  );
};

export default ConnectionButton;
