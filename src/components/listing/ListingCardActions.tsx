
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
            className: "bg-sourceco-muted text-sourceco-accent border border-sourceco-form hover:bg-sourceco-muted"
          };
        case "approved":
          return { 
            icon: CheckCircle2, 
            text: "Access Granted", 
            variant: "connected" as const, 
            disabled: true,
            className: "bg-emerald-50/40 text-emerald-700 border border-emerald-200/40"
          };
        case "rejected":
          return { 
            icon: XCircle, 
            text: "Not Selected", 
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
      {/* Action Buttons */}
      <div className="space-y-1.5">
        {/* Approved State - Dark "View Deal Details" primary */}
        {connectionExists && connectionStatus === "approved" ? (
          <>
            <Button
              className={`w-full ${viewType === 'list' ? 'h-8' : 'h-10'} px-4 text-[13px] font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow transition-all duration-200`}
            >
              <Eye className="h-3.5 w-3.5 mr-2" />
              <span>View Deal Details</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className={`w-full ${viewType === 'list' ? 'h-8' : 'h-9'} px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors`}
              onClick={handleToggleSave}
              disabled={isSaving}
            >
              <Bookmark className={`h-3 w-3 mr-2 ${isSaved ? "fill-current text-sourceco-accent" : "text-slate-400"}`} />
              <span>{isSaved ? "Saved" : "Save Deal"}</span>
            </Button>
          </>
        ) : (
          <>
            {/* Primary CTA - Dark Slate instead of Gold */}
            <Button
              className={`w-full ${viewType === 'list' ? 'h-8' : 'h-11'} px-4 text-[13px] font-semibold rounded-lg transition-all duration-200 
                ${connectionDisabled && connectionStatus !== "rejected"
                  ? connectionClassName + " shadow-none"
                  : "bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow-md active:shadow-sm"
                }`}
              onClick={handleConnectionClick}
              disabled={isRequesting || (connectionDisabled && connectionStatus !== "rejected")}
            >
              <div className="flex items-center justify-center gap-2">
                <ConnectionIcon className="h-4 w-4" />
                <span>{isRequesting ? "Sending..." : connectionText}</span>
              </div>
            </Button>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <Button
                variant="ghost"
                className={`${viewType === 'list' ? 'h-8' : 'h-9'} px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors`}
                size="sm"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                <span>Details</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className={`${viewType === 'list' ? 'h-8' : 'h-9'} px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors`}
                onClick={handleToggleSave}
                disabled={isSaving}
              >
                <Bookmark
                  className={`h-3.5 w-3.5 mr-1.5 transition-colors ${
                    isSaved ? "fill-current text-sourceco-accent" : "text-slate-500"
                  }`}
                />
                <span>{isSaved ? "Saved" : "Save"}</span>
              </Button>
            </div>
          </>
        )}
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
