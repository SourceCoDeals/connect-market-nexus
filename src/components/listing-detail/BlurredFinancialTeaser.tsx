import { useState } from "react";
import { Button } from "@/components/ui/button";
import ConnectionRequestDialog from "@/components/connection/ConnectionRequestDialog";
import { LockIcon } from "@/components/icons/MetricIcons";

interface BlurredFinancialTeaserProps {
  onRequestConnection: (message?: string) => void;
  isRequesting: boolean;
  hasConnection: boolean;
  connectionStatus: string;
  listingTitle?: string;
}

const BlurredFinancialTeaser = ({ 
  onRequestConnection, 
  isRequesting, 
  hasConnection, 
  connectionStatus,
  listingTitle 
}: BlurredFinancialTeaserProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Don't show if already connected
  if (hasConnection && connectionStatus === "approved") {
    return null;
  }

  const handleDialogSubmit = (message: string) => {
    onRequestConnection(message);
    setIsDialogOpen(false);
  };

  const handleButtonClick = () => {
    if (!hasConnection || connectionStatus === "rejected") {
      setIsDialogOpen(true);
    }
  };

  return (
    <div className="relative bg-white border border-slate-200/80 overflow-hidden rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[360px]">
      <div className="relative p-8">
        {/* Minimal blurred preview */}
        <div className="mb-8 space-y-4 blur-[2px] select-none pointer-events-none opacity-30">
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <div className="h-2 bg-slate-300 rounded w-16"></div>
              <div className="h-3 bg-slate-300 rounded w-20"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 bg-slate-300 rounded w-16"></div>
              <div className="h-3 bg-slate-300 rounded w-20"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 bg-slate-300 rounded w-16"></div>
              <div className="h-3 bg-slate-300 rounded w-20"></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="h-2 bg-slate-300 rounded w-full"></div>
            <div className="h-2 bg-slate-300 rounded w-5/6"></div>
            <div className="h-2 bg-slate-300 rounded w-4/5"></div>
          </div>
        </div>

        {/* Clean CTA overlay */}
        <div className="absolute inset-0 flex items-start justify-center bg-white pt-16 md:pt-24 px-8">
          <div className="text-center w-full max-w-lg mx-auto">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-5">
              <LockIcon className="w-6 h-6 text-slate-600" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              Unlock Detailed Financial Analysis
            </h3>
            <p className="text-[15px] text-slate-600 mb-6 leading-relaxed px-4">
              Request a connection to access comprehensive financial data, historical performance, and detailed business metrics.
            </p>
            
            <Button
              onClick={handleButtonClick}
              disabled={isRequesting || (hasConnection && connectionStatus !== "rejected")}
              className="bg-sourceco-accent text-white hover:bg-sourceco-accent/90 transition-colors px-8 h-11 text-sm font-medium rounded-md shadow-sm"
            >
              <LockIcon className="w-4 h-4 mr-2" />
              {isRequesting ? "Sending Request..." : hasConnection && connectionStatus !== "rejected" ? "Request Sent" : "Request Connection"}
            </Button>
          </div>
        </div>
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

export default BlurredFinancialTeaser;