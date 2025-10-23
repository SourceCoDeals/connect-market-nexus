
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark, CheckCircle2, Clock, XCircle, Send, ArrowUpRight, Eye } from "lucide-react";
import ConnectionRequestDialog from "@/components/connection/ConnectionRequestDialog";

interface ListingCardActionsProps {
  viewType: "grid" | "list";
  connectionExists: boolean;
  connectionStatus: string;
  isRequesting: boolean;
  isSaved: boolean | undefined;
  isSaving: boolean;
  handleRequestConnection: (message: string) => void;
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

  const getConnectionButtonContent = () => {
    if (connectionExists) {
      switch (connectionStatus) {
        case "pending":
          return { 
            icon: Clock, 
            text: "Request Sent", 
            variant: "pending" as const, 
            disabled: true,
            className: "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
          };
        case "approved":
          return { 
            icon: CheckCircle2, 
            text: "Connected", 
            variant: "connected" as const, 
            disabled: true,
            className: "bg-emerald-50 text-emerald-700 border border-emerald-200"
          };
        case "rejected":
          return { 
            icon: XCircle, 
            text: "Request Declined", 
            variant: "rejected" as const, 
            disabled: false,
            className: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
          };
        default:
          return { 
            icon: Send, 
            text: "Request Access", 
            variant: "default" as const, 
            disabled: false,
            className: ""
          };
      }
    }
    return { 
      icon: Send, 
      text: "Request Access", 
      variant: "default" as const, 
      disabled: false,
      className: ""
    };
  };

  const { icon: ConnectionIcon, text: connectionText, disabled: connectionDisabled, className: connectionClassName } = getConnectionButtonContent();

  const handleConnectionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!connectionDisabled || connectionStatus === "rejected") {
      setIsDialogOpen(true);
    }
  };

  const handleDialogSubmit = (message: string) => {
    handleRequestConnection(message);
    setIsDialogOpen(false);
  };

  return (
    <>
      {/* Primary CTA - Request Connection */}
      <Button
        className={`w-full h-11 px-5 text-sm font-medium rounded-lg relative overflow-hidden transition-all duration-200 
          ${connectionDisabled && connectionStatus !== "rejected"
            ? connectionClassName + " shadow-none"
            : "bg-foreground text-background hover:bg-foreground/90 shadow-sm hover:shadow-md"
          }`}
        onClick={handleConnectionClick}
        disabled={isRequesting || (connectionDisabled && connectionStatus !== "rejected")}
      >
        <div className="relative flex items-center justify-center gap-2">
          <ConnectionIcon className="h-4 w-4" />
          <span>{isRequesting ? "Sending..." : connectionText}</span>
        </div>
      </Button>

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button
          variant="outline"
          className="h-9 px-3 text-xs font-medium border-border/60 hover:border-border hover:bg-muted/40 transition-all duration-200"
          size="sm"
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          <span>Details</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 text-xs font-medium border-border/60 hover:border-border hover:bg-muted/40 transition-all duration-200"
          onClick={handleToggleSave}
          disabled={isSaving}
        >
          <Bookmark
            className={`h-3.5 w-3.5 mr-1.5 transition-colors ${
              isSaved ? "fill-foreground text-foreground" : "text-muted-foreground"
            }`}
          />
          <span>{isSaved ? "Saved" : "Save"}</span>
        </Button>
      </div>

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

export default ListingCardActions;
