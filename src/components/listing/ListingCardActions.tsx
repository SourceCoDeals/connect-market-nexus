
import { Button } from "@/components/ui/button";
import { Bookmark, CheckCircle, Clock, XCircle, ExternalLink } from "lucide-react";

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

  return (
    <div
      className={`flex ${
        viewType === "list" ? "flex-col gap-3 w-full" : "w-full"
      }`}
    >
      <Button
        className={`${viewType === "list" ? "w-full" : "flex-1"} text-xs md:text-sm`}
        size={viewType === "list" ? "sm" : "default"}
        variant="outline"
      >
        <ExternalLink className="h-4 w-4 mr-1" />
        See details
      </Button>

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
    </div>
  );
};

export default ListingCardActions;
