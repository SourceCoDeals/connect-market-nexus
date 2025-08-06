
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
}

const ConnectionButton = ({
  connectionExists,
  connectionStatus,
  isRequesting,
  isAdmin,
  handleRequestConnection,
  listingTitle
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
            className: "bg-amber-50 text-amber-700 border-2 border-amber-200 cursor-default hover:bg-amber-50",
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

  return (
    <>
      <Button
        onClick={handleButtonClick}
        disabled={disabled || isRequesting}
        className="w-full h-12 bg-sourceco-accent hover:bg-opacity-90 text-white font-semibold text-sm transition-all duration-200"
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
    </>
  );
};

export default ConnectionButton;
