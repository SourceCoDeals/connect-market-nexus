
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, Send } from "lucide-react";

interface ListingDetailActionsProps {
  isAdmin: boolean;
  connectionExists: boolean;
  connectionStatus: string;
  isRequesting: boolean;
  onRequestConnection: () => void;
}

export const ListingDetailActions = ({
  isAdmin,
  connectionExists,
  connectionStatus,
  isRequesting,
  onRequestConnection
}: ListingDetailActionsProps) => {
  if (isAdmin) return null;
  
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
          onClick={onRequestConnection}
        >
          <XCircle className="mr-2 h-4 w-4" /> Rejected - Resubmit
        </Button>
      );
    }
  }
  
  return (
    <Button
      variant="default"
      className="w-full md:w-auto"
      disabled={isRequesting}
      onClick={onRequestConnection}
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
