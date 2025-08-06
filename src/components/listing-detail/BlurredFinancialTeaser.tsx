import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, TrendingUp, Calculator, PieChart, BarChart3 } from "lucide-react";
import ConnectionRequestDialog from "@/components/connection/ConnectionRequestDialog";
import financialMetricsBg from "@/assets/financial-metrics-bg.jpg";

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
    <div className="relative border border-slate-200 bg-white overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img 
          src={financialMetricsBg} 
          alt=""
          className="w-full h-full object-cover opacity-20 blur-[2px]"
        />
      </div>
      
      <div className="relative p-6">
        <span className="document-label">Detailed Financial Analysis</span>
        
        {/* Blurred content preview */}
        <div className="mt-6 space-y-6 blur-sm select-none pointer-events-none">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="document-label">Cash Flow Analysis</span>
              <div className="h-3 bg-slate-200 rounded w-24"></div>
              <div className="h-2 bg-slate-200 rounded w-16"></div>
            </div>
            <div className="space-y-2">
              <span className="document-label">Profit Margins</span>
              <div className="h-3 bg-slate-200 rounded w-20"></div>
              <div className="h-2 bg-slate-200 rounded w-14"></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <span className="document-label">Historical Performance</span>
            <div className="space-y-2">
              <div className="h-2 bg-slate-200 rounded w-full"></div>
              <div className="h-2 bg-slate-200 rounded w-4/5"></div>
              <div className="h-2 bg-slate-200 rounded w-3/4"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="h-2 bg-slate-200 rounded"></div>
              <div className="h-2 bg-slate-200 rounded w-3/4"></div>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-slate-200 rounded"></div>
              <div className="h-2 bg-slate-200 rounded w-2/3"></div>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-slate-200 rounded"></div>
              <div className="h-2 bg-slate-200 rounded w-4/5"></div>
            </div>
          </div>
        </div>

        {/* Overlay with call to action */}
        <div className="absolute inset-0 bg-white/95 flex items-center justify-center">
          <div className="text-center px-6 py-8">
            <div className="mb-6">
              <Lock className="h-8 w-8 text-slate-500 mx-auto mb-4" />
              <h3 className="document-value mb-2">Unlock Detailed Financial Analysis</h3>
              <p className="document-subtitle max-w-md mx-auto mb-6">
                Request a connection to access comprehensive financial data, historical performance, 
                and detailed business metrics.
              </p>
            </div>
            
            <Button
              onClick={handleButtonClick}
              disabled={isRequesting || (hasConnection && connectionStatus !== "rejected")}
              className="bg-slate-900 text-white hover:bg-slate-800 transition-colors px-6 py-2 text-sm font-medium"
            >
              <Lock className="h-4 w-4 mr-2" />
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