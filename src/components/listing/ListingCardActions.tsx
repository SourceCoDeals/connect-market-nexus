
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark, CheckCircle2, Clock, XCircle, Send, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
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
            text: "Request Pending", 
            variant: "pending" as const, 
            disabled: true,
            className: "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50"
          };
        case "approved":
          return { 
            icon: CheckCircle2, 
            text: "Connected", 
            variant: "connected" as const, 
            disabled: true,
            className: "bg-white text-emerald-700 border border-emerald-200 hover:bg-white"
          };
        case "rejected":
          return { 
            icon: Send, 
            text: "Resubmit Request", 
            variant: "default" as const, 
            disabled: false,
            className: ""
          };
        default:
          return { 
            icon: Send, 
            text: "Request Connection", 
            variant: "default" as const, 
            disabled: false,
            className: ""
          };
      }
    }
    return { 
      icon: Send, 
      text: "Request Connection", 
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
    <div className="flex flex-col gap-3 w-full mt-6 pt-6 border-t border-slate-100">
      {/* Primary CTA - Request Connection */}
      <Button
        className={cn(
          "w-full h-11 px-4 text-[13px] font-semibold rounded-lg transition-all duration-150",
          connectionDisabled && connectionStatus !== "rejected"
            ? connectionClassName
            : "bg-[#D7B65C] hover:bg-[#C9A84F] text-slate-900 border-0 shadow-sm"
        )}
        onClick={handleConnectionClick}
        disabled={isRequesting || (connectionDisabled && connectionStatus !== "rejected")}
      >
        <ConnectionIcon className="h-4 w-4 mr-2" />
        <span>{isRequesting ? "Sending..." : connectionText}</span>
      </Button>

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-10 px-4 text-[13px] font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors duration-150"
          size="sm"
        >
          <Eye className="h-3.5 w-3.5 mr-2" />
          Details
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-10 px-4 text-[13px] font-medium border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg transition-all duration-150"
          onClick={handleToggleSave}
          disabled={isSaving}
        >
          <Bookmark
            className={cn(
              "h-3.5 w-3.5 mr-2",
              isSaved ? "fill-[#D7B65C] text-[#D7B65C]" : "text-slate-400"
            )}
          />
          {isSaved ? "Saved" : "Save"}
        </Button>
      </div>

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
