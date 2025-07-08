
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark, Clock, CheckCircle, XCircle, Send } from "lucide-react";
import ConnectionRequestDialog from "@/components/connection/ConnectionRequestDialog";

interface ListingCardActionsProps {
  viewType: "grid" | "list";
  connectionExists: boolean;
  connectionStatus: string;
  isRequesting: boolean;
  isSaved: boolean | undefined;
  isSaving: boolean;
  handleRequestConnection: (e: React.MouseEvent, message?: string) => void;
  handleToggleSave: (e: React.MouseEvent) => void;
  listingTitle?: string;
}

const ListingCardActions = ({
  viewType,
  connectionExists,
  connectionStatus,
  isRequesting,
  isSaved,
  isSaving,
  handleRequestConnection,
  handleToggleSave,
  listingTitle
}: ListingCardActionsProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDialogSubmit = (message: string) => {
    // Create a mock event for the existing handler
    const mockEvent = { stopPropagation: () => {} } as React.MouseEvent;
    handleRequestConnection(mockEvent, message);
    setIsDialogOpen(false);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectionExists && connectionStatus === "rejected") {
      // For rejected requests, open dialog for resubmission
      setIsDialogOpen(true);
    } else if (!connectionExists) {
      // For new requests, open dialog
      setIsDialogOpen(true);
    } else {
      // For other cases, use existing handler
      handleRequestConnection(e);
    }
  };

  // Helper function to render appropriate button based on connection status
  const renderConnectionButton = () => {
    if (connectionExists) {
      if (connectionStatus === "pending") {
        return (
          <Button
            className={`${viewType === "list" ? "w-full" : "flex-1"} text-xs md:text-sm`}
            size={viewType === "list" ? "sm" : "default"}
            variant="secondary"
            disabled={true}
          >
            <Clock className="h-4 w-4 mr-1" /> Requested
          </Button>
        );
      } else if (connectionStatus === "approved") {
        return (
          <Button
            className={`${viewType === "list" ? "w-full" : "flex-1"} text-xs md:text-sm bg-green-600 hover:bg-green-700`}
            size={viewType === "list" ? "sm" : "default"}
            disabled={true}
          >
            <CheckCircle className="h-4 w-4 mr-1" /> Connected
          </Button>
        );
      } else if (connectionStatus === "rejected") {
        return (
          <Button
            className={`${viewType === "list" ? "w-full" : "flex-1"} text-xs md:text-sm`}
            size={viewType === "list" ? "sm" : "default"}
            variant="outline"
            onClick={handleButtonClick}
            disabled={isRequesting}
          >
            <XCircle className="h-4 w-4 mr-1" /> Resubmit
          </Button>
        );
      }
    }

    // Default state - no connection exists
    return (
      <Button
        className={`${viewType === "list" ? "w-full" : "flex-1"} text-xs md:text-sm`}
        size={viewType === "list" ? "sm" : "default"}
        disabled={isRequesting}
        onClick={handleButtonClick}
      >
        {isRequesting ? (
          <Clock className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-1" />
        )}
        {isRequesting ? "Requesting..." : "Request"}
      </Button>
    );
  };

  return (
    <div
      className={`flex ${
        viewType === "list" ? "flex-col gap-3 w-full" : "w-full"
      }`}
    >
      {renderConnectionButton()}

      <Button
        variant="outline"
        size="icon"
        className={viewType === "list" ? "self-center" : "ml-2"}
        onClick={handleToggleSave}
        disabled={isSaving}
      >
        <Bookmark
          className={`h-5 w-5 ${
            isSaved ? "fill-current text-primary" : ""
          }`}
        />
        <span className="sr-only">
          {isSaved ? "Unsave" : "Save"} listing
        </span>
      </Button>

      <ConnectionRequestDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        isSubmitting={isRequesting}
        listingTitle={listingTitle}
      />
    </div>
  );
};

export default ListingCardActions;
