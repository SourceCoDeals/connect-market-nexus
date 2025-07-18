import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Eye, TrendingUp, DollarSign } from "lucide-react";

interface BlurredFinancialsProps {
  onRequestConnection: () => void;
  isRequesting: boolean;
  connectionExists: boolean;
  connectionStatus: string;
}

const BlurredFinancials = ({ 
  onRequestConnection, 
  isRequesting, 
  connectionExists, 
  connectionStatus 
}: BlurredFinancialsProps) => {
  const canViewFinancials = connectionExists && connectionStatus === "approved";

  if (canViewFinancials) {
    return null; // Don't show blurred version if user has access
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Financial Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Blurred Financial Data */}
        <div className="relative">
          <div className="filter blur-sm select-none pointer-events-none opacity-40">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                <p className="text-lg font-semibold">$2,400,000</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">EBITDA</p>
                <p className="text-lg font-semibold">$720,000</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-sm">Gross Margin</span>
                <span className="text-sm font-medium">42.5%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Net Margin</span>
                <span className="text-sm font-medium">18.2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Cash Flow</span>
                <span className="text-sm font-medium">$650,000</span>
              </div>
            </div>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-transparent rounded-md" />
          
          {/* Lock Icon and CTA */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-center bg-white p-4 rounded-lg shadow-lg border max-w-xs">
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-[#D7B65C] to-[#E5C76A] rounded-full mx-auto mb-3">
                <Lock className="h-6 w-6 text-slate-900" />
              </div>
              <h3 className="font-semibold text-sm mb-2">Financial Details</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Request a connection to view detailed financial information
              </p>
              <Button
                size="sm"
                onClick={onRequestConnection}
                disabled={isRequesting || (connectionExists && connectionStatus === "pending")}
                className="group relative bg-gradient-to-r from-[#D7B65C] via-[#E5C76A] to-[#D7B65C] text-slate-900 border-0 hover:shadow-lg hover:shadow-[rgba(215,182,92,0.2)] hover:scale-[1.02] text-xs px-4 py-2"
              >
                {/* Premium button effects */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#E5C76A] via-[#F0D478] to-[#E5C76A] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md" />
                
                <div className="relative flex items-center gap-1.5">
                  <Eye className="h-3 w-3" />
                  <span>
                    {isRequesting 
                      ? "Requesting..." 
                      : connectionExists && connectionStatus === "pending"
                        ? "Request Sent"
                        : "Request Access"
                    }
                  </span>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BlurredFinancials;