
import { Button } from "@/components/ui/button";
import { Bookmark, CheckCircle, Clock, XCircle, MessageSquarePlus, ArrowRight } from "lucide-react";

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
      <div className="group relative">
        <Button
          className="w-full h-10 px-6 py-2.5 text-sm font-semibold tracking-wide text-slate-900 rounded-lg relative overflow-hidden cursor-pointer bg-gradient-to-r from-[#D7B65C] via-[#E5C76A] to-[#D7B65C] border-0 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl hover:shadow-[rgba(215,182,92,0.25)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
          onClick={handleRequestConnection}
          disabled={isRequesting || connectionDisabled}
        >
          {/* Hover Background Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#E5C76A] via-[#F0D478] to-[#E5C76A] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.2)] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
          
          {/* Button Content */}
          <div className="relative flex items-center justify-center">
            <ConnectionIcon className="h-4 w-4 mr-2 transition-transform duration-300" />
            <span>{isRequesting ? "Sending Request..." : connectionText}</span>
            <ArrowRight className="h-4 w-4 ml-2 transition-transform duration-300 group-hover:translate-x-0.5" />
          </div>
        </Button>
      </div>

      {/* Secondary CTAs */}
      <div className="flex gap-2">
        <div className="group relative flex-1">
          <Button
            className="w-full h-9 px-4 py-2 text-sm font-medium tracking-wide text-slate-900 rounded-lg relative overflow-hidden cursor-pointer bg-gradient-to-r from-[#D7B65C] via-[#E5C76A] to-[#D7B65C] border-0 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-[rgba(215,182,92,0.2)] opacity-90"
            size="sm"
          >
            {/* Hover Background Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#E5C76A] via-[#F0D478] to-[#E5C76A] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.2)] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
            
            {/* Button Content */}
            <div className="relative flex items-center justify-center">
              <span>View Details</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </div>
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-9 px-4 border-2 border-slate-200 hover:border-[#D7B65C] hover:bg-[#D7B65C]/5 transition-all duration-200 hover:scale-[1.02] bg-white shadow-sm"
          onClick={handleToggleSave}
          disabled={isSaving}
        >
          <Bookmark
            className={`h-4 w-4 transition-colors duration-200 ${
              isSaved 
                ? "fill-[#D7B65C] text-[#D7B65C]" 
                : "text-slate-400 hover:text-[#D7B65C]"
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
