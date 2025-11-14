
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Clock, CheckCircle2, XCircle, Wifi } from "lucide-react";
import ConnectionRequestDialog from "@/components/connection/ConnectionRequestDialog";
import { useRealtime } from "@/components/realtime/RealtimeProvider";

interface ConnectionButtonProps {
  connectionExists: boolean;
  connectionStatus: string;
  isRequesting: boolean;
  isAdmin: boolean;
  handleRequestConnection: (message?: string) => void;
  listingTitle?: string;
  listingId: string;
}

const ConnectionButton = ({
  connectionExists,
  connectionStatus,
  isRequesting,
  isAdmin,
  handleRequestConnection,
  listingTitle,
  listingId,
}: ConnectionButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { connectionsConnected } = useRealtime();

  const handleDialogSubmit = (message: string) => {
    handleRequestConnection(message);
    setIsDialogOpen(false);
  };

  const handleButtonClick = () => {
    if (!connectionExists || connectionStatus === "rejected") {
      setIsDialogOpen(true);
    }
  };

  const getButtonContent = () => {
    if (connectionExists) {
      switch (connectionStatus) {
        case "pending":
          return {
            icon: Clock,
            text: "Connection Request Sent",
            className: "bg-sourceco-muted text-sourceco-accent border-2 border-sourceco-form cursor-default hover:bg-sourceco-muted",
            disabled: true
          };
        case "approved":
          return {
            icon: CheckCircle2,
            text: "Connected",
            className: "bg-emerald-50 text-emerald-700 border-2 border-emerald-200 cursor-default hover:bg-emerald-50",
            disabled: true
          };
        case "rejected":
          return {
            icon: Send,
            text: "Request Connection Again",
            className: "bg-sourceco-accent text-sourceco-accent-foreground hover:bg-sourceco-accent/90 border-none",
            disabled: false
          };
        default:
          return {
            icon: Send,
            text: "Request Connection",
            className: "bg-sourceco-accent text-sourceco-accent-foreground hover:bg-sourceco-accent/90 border-none",
            disabled: false
          };
      }
    }

    return {
      icon: Send,
      text: "Request Connection",
      className: "bg-sourceco-accent text-sourceco-accent-foreground hover:bg-sourceco-accent/90 border-none",
      disabled: false
    };
  };

  const { icon: ButtonIcon, text: buttonText, className, disabled } = getButtonContent();
  const isPremiumButton = className.includes("gradient");

  if (isAdmin) {
    return (
      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Wifi className="h-5 w-5 text-blue-600" />
        <div>
          <p className="text-sm font-medium text-blue-900">Admin Access</p>
          <p className="text-xs text-blue-700">You have full access to this listing</p>
        </div>
      </div>
    );
  }

  // Special layout for approved connections
  if (connectionExists && connectionStatus === "approved") {
    return (
      <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <div>
          <p className="text-sm font-medium text-emerald-900">Connected</p>
          <p className="text-xs text-emerald-700">Your connection request has been approved</p>
        </div>
        {connectionsConnected && (
          <Wifi className="h-3 w-3 text-emerald-500 ml-auto" />
        )}
      </div>
    );
  }

  // Special layout for rejected connections
  if (connectionExists && connectionStatus === "rejected") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-red-50 to-red-100/80 border border-red-200 rounded-lg shadow-sm">
          <XCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-700">Not Selected</p>
            <p className="text-xs text-red-600">The owner has made their selection for this opportunity</p>
          </div>
        </div>
        <Button
          onClick={handleButtonClick}
          disabled={isRequesting}
          className="w-full h-11 text-sm font-medium transition-colors duration-200 bg-slate-900 hover:bg-slate-800 text-white"
        >
          <div className="flex items-center justify-center gap-2">
            <Send className="h-4 w-4" />
            <span>{isRequesting ? "Sending Request..." : "Explore Other Opportunities"}</span>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Main Connection Button */}
      <Button
        onClick={handleButtonClick}
        disabled={disabled || isRequesting}
        className={`w-full h-11 text-sm font-medium transition-colors duration-200 ${className}`}
      >
        <div className="flex items-center justify-center gap-2">
          <ButtonIcon className="h-4 w-4" />
          <span>{isRequesting ? "Sending Request..." : buttonText}</span>
        </div>

        {/* Realtime indicator - only show on non-disabled buttons */}
        {connectionsConnected && !disabled && (
          <Wifi className="absolute -top-1 -right-1 h-3 w-3 text-green-500" />
        )}
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

export default ConnectionButton;
