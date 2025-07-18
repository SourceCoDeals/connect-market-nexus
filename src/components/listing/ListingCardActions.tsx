
import { Button } from "@/components/ui/button";
import { Bookmark, CheckCircle, Clock, XCircle, ExternalLink, MessageSquarePlus, ArrowRight } from "lucide-react";

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
          return { icon: Clock, text: "Request Pending", variant: "secondary" as const, disabled: true };
        case "approved":
          return { icon: CheckCircle, text: "Connected", variant: "default" as const, disabled: true };
        case "rejected":
          return { icon: XCircle, text: "Request Declined", variant: "destructive" as const, disabled: false };
        default:
          return { icon: MessageSquarePlus, text: "Request Connection", variant: "default" as const, disabled: false };
      }
    }
    return { icon: MessageSquarePlus, text: "Request Connection", variant: "default" as const, disabled: false };
  };

  const { icon: ConnectionIcon, text: connectionText, variant: connectionVariant, disabled: connectionDisabled } = getConnectionButtonContent();

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Primary CTA - Request Connection */}
      <Button
        className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:via-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-600/25 border-0 transition-all duration-200 hover:shadow-xl hover:shadow-blue-600/30 hover:scale-[1.02]"
        onClick={handleRequestConnection}
        disabled={isRequesting || connectionDisabled}
      >
        <ConnectionIcon className="h-4 w-4 mr-2" />
        {isRequesting ? "Sending Request..." : connectionText}
      </Button>

      {/* Secondary CTAs */}
      <div className="flex gap-2">
        <Button
          className="flex-1 h-9 text-sm font-medium bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-900 shadow-md shadow-amber-400/20 border-0 transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/25 hover:scale-[1.01]"
          size="sm"
        >
          <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
          View Details
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 px-4 border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 hover:scale-[1.02] bg-white shadow-sm"
          onClick={handleToggleSave}
          disabled={isSaving}
        >
          <Bookmark
            className={`h-4 w-4 transition-colors duration-200 ${
              isSaved 
                ? "fill-blue-600 text-blue-600" 
                : "text-slate-400 hover:text-blue-600"
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
