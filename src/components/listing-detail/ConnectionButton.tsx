
import { Button } from "@/components/ui/button";
import { Send, Clock, CheckCircle, XCircle } from "lucide-react";

interface ConnectionButtonProps {
  connectionExists: boolean;
  connectionStatus: string;
  isRequesting: boolean;
  isAdmin: boolean;
  handleRequestConnection: () => void;
}

const ConnectionButton = ({
  connectionExists,
  connectionStatus,
  isRequesting,
  isAdmin,
  handleRequestConnection
}: ConnectionButtonProps) => {
  if (isAdmin) return null; // Admins don't see connection buttons
  
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
        <Button
          variant="outline"
          className="w-full md:w-auto text-red-600 border-red-200"
          onClick={handleRequestConnection}
        >
          <XCircle className="mr-2 h-4 w-4" /> Rejected - Resubmit
        </Button>
      );
    }
  }
  
  // Default state - no connection request exists
  return (
    <Button
      variant="default"
      className="w-full md:w-auto"
      disabled={isRequesting}
      onClick={handleRequestConnection}
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
  );
};

export default ConnectionButton;
