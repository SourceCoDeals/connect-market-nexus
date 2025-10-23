
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
    <div className="flex flex-col gap-2.5 w-full mt-auto pt-5 border-t border-border/30">
      {/* Primary CTA - Request Connection */}
      <div className="group relative">
        <Button
          className={`w-full h-10 px-4 text-[13px] font-semibold tracking-[-0.005em] rounded-lg relative overflow-hidden cursor-pointer border-0 transition-all duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed ${
            connectionDisabled && connectionStatus !== "rejected"
              ? connectionClassName
              : "text-slate-900 bg-[#D7B65C] hover:bg-[#C9A954] shadow-sm hover:shadow-md"
          }`}
          onClick={handleConnectionClick}
          disabled={isRequesting || (connectionDisabled && connectionStatus !== "rejected")}
        >
          <div className="relative flex items-center justify-center gap-2">
            <ConnectionIcon className="h-4 w-4" />
            <span className="font-semibold">{isRequesting ? "Sending..." : connectionText}</span>
          </div>
        </Button>
      </div>

      {/* Secondary Actions */}
      <div className="flex gap-2">
        <Button
          className="flex-1 h-9 px-3 text-[12px] font-medium text-slate-700 dark:text-slate-300 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 border border-border/60 hover:border-border transition-all duration-150 rounded-lg"
          size="sm"
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          <span>Details</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 border border-border/60 hover:border-border hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-150 bg-transparent rounded-lg flex-1"
          onClick={handleToggleSave}
          disabled={isSaving}
        >
          <Bookmark
            className={`h-3.5 w-3.5 mr-1.5 transition-colors duration-150 ${
              isSaved 
                ? "fill-[#D7B65C] text-[#D7B65C]" 
                : "text-muted-foreground/60"
            }`}
          />
          <span className="text-[12px] font-medium">
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
