
import { Button } from "@/components/ui/button";
import { Bookmark, CheckCircle, Clock, XCircle, ExternalLink, MessageSquare } from "lucide-react";

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

  const getConnectionButtonContent = () => {
    if (connectionExists) {
      switch (connectionStatus) {
        case "pending":
          return { icon: Clock, text: "Pending", variant: "secondary" as const };
        case "approved":
          return { icon: CheckCircle, text: "Connected", variant: "default" as const };
        case "rejected":
          return { icon: XCircle, text: "Declined", variant: "destructive" as const };
        default:
          return { icon: MessageSquare, text: "Connect", variant: "default" as const };
      }
    }
    return { icon: MessageSquare, text: "Connect", variant: "default" as const };
  };

  const { icon: ConnectionIcon, text: connectionText, variant: connectionVariant } = getConnectionButtonContent();

  return (
    <div
      className={`flex ${
        viewType === "list" ? "flex-col gap-2 w-full" : "flex-col gap-2 w-full"
      }`}
    >
      <Button
        className={`${viewType === "list" ? "w-full" : "w-full"} text-xs md:text-sm bg-primary hover:bg-primary/90 text-primary-foreground`}
        size={viewType === "list" ? "sm" : "sm"}
        onClick={handleRequestConnection}
        disabled={isRequesting || (connectionExists && connectionStatus !== "rejected")}
      >
        <ConnectionIcon className="h-3.5 w-3.5 mr-1.5" />
        {isRequesting ? "Requesting..." : connectionText}
      </Button>

      <div className="flex gap-2">
        <Button
          className={`${viewType === "list" ? "flex-1" : "flex-1"} text-xs md:text-sm`}
          size={viewType === "list" ? "sm" : "sm"}
          variant="outline"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          See details
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="px-3"
          onClick={handleToggleSave}
          disabled={isSaving}
        >
          <Bookmark
            className={`h-4 w-4 ${
              isSaved ? "fill-current text-primary" : ""
            }`}
          />
          <span className="sr-only">
            {isSaved ? "Unsave" : "Save"} listing
          </span>
        </Button>
      </div>
    </div>
  );
};

export default ListingCardActions;
