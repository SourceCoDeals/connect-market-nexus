
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
    <div className="flex flex-col gap-2 w-full mt-auto pt-3 border-t border-border/40">
      {/* Primary CTA - Request Connection */}
      <div className="group relative">
        <Button
          className={`w-full h-9 px-4 py-2 text-[13px] font-semibold tracking-tight rounded-lg relative overflow-hidden cursor-pointer border-0 transition-all duration-200 ease-out hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none ${
            connectionDisabled && connectionStatus !== "rejected"
              ? connectionClassName
              : "text-slate-900 bg-gradient-to-r from-[#D7B65C] via-[#E5C76A] to-[#D7B65C] hover:shadow-md shadow-sm"
          }`}
          onClick={handleConnectionClick}
          disabled={isRequesting || (connectionDisabled && connectionStatus !== "rejected")}
        >
          {/* Subtle Hover Effects for Active States Only */}
          {!connectionDisabled && (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-[#E5C76A] via-[#F0D478] to-[#E5C76A] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </>
          )}
          
          <div className="relative flex items-center justify-center gap-1.5">
            <ConnectionIcon className="h-3.5 w-3.5" />
            <span className="font-semibold">{isRequesting ? "Sending..." : connectionText}</span>
          </div>
        </Button>
      </div>

      {/* Secondary Actions */}
      <div className="flex gap-2">
        <Button
          className="flex-1 h-8 px-3 py-1.5 text-[12px] font-semibold text-white bg-slate-900 hover:bg-slate-800 border-0 transition-all duration-150 rounded-lg shadow-sm"
          size="sm"
        >
          <Eye className="h-3 w-3 mr-1.5" />
          <span>Details</span>
          <ArrowUpRight className="h-3 w-3 ml-1.5 opacity-60" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 py-1.5 border border-border/60 hover:border-border hover:bg-muted/30 transition-all duration-150 bg-card shadow-sm rounded-lg flex-1"
          onClick={handleToggleSave}
          disabled={isSaving}
        >
          <Bookmark
            className={`h-3.5 w-3.5 mr-1.5 transition-colors duration-150 ${
              isSaved 
                ? "fill-[#D7B65C] text-[#D7B65C]" 
                : "text-muted-foreground/60 hover:text-[#D7B65C]"
            }`}
          />
          <span className="text-[12px] font-semibold">
            {isSaved ? "Saved" : "Save"}
          </span>
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
