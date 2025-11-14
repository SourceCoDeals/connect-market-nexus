
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
            text: "Request pending",
            className: "bg-slate-100 text-slate-700 border border-slate-200 cursor-default hover:bg-slate-100",
            disabled: true
          };
        case "approved":
          return {
            text: "Connected",
            className: "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default hover:bg-emerald-50",
            disabled: true
          };
        case "rejected":
          return {
            text: "Request again",
            className: "bg-slate-900 text-white hover:bg-slate-800 border-none",
            disabled: false
          };
        default:
          return {
            text: "Request connection",
            className: "bg-slate-900 text-white hover:bg-slate-800 border-none",
            disabled: false
          };
      }
    }

    return {
      text: "Request connection",
      className: "bg-slate-900 text-white hover:bg-slate-800 border-none",
      disabled: false
    };
  };

  const { text: buttonText, className, disabled } = getButtonContent();

  if (isAdmin) {
    return (
      <div className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
        <p className="text-sm font-medium text-blue-900">Admin Access</p>
        <p className="text-xs text-blue-700 mt-0.5">You have full access to this listing</p>
      </div>
    );
  }

  // Special layout for approved connections
  if (connectionExists && connectionStatus === "approved") {
    return (
      <div className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
        <p className="text-sm font-medium text-emerald-900">Connected</p>
        <p className="text-xs text-emerald-700 mt-0.5">Your connection request has been approved</p>
      </div>
    );
  }

  // Special layout for rejected connections
  if (connectionExists && connectionStatus === "rejected") {
    return (
      <div className="space-y-3">
        <div className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-center">
          <p className="text-sm font-semibold text-red-700">Not Selected</p>
          <p className="text-xs text-red-600 mt-0.5">The owner has made their selection for this opportunity</p>
        </div>
        <Button
          onClick={handleButtonClick}
          disabled={isRequesting}
          className="w-full h-11 text-[15px] font-medium tracking-wide transition-colors bg-slate-900 hover:bg-slate-800 text-white"
        >
          {isRequesting ? "Sending request..." : "Explore other opportunities"}
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
        className={`w-full h-11 text-[15px] font-medium tracking-wide transition-colors ${className}`}
      >
        {isRequesting ? "Sending request..." : buttonText}
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
