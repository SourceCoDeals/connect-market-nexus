import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, TrendingUp, Calculator, PieChart, BarChart3 } from "lucide-react";

interface BlurredFinancialTeaserProps {
  onRequestConnection: () => void;
  isRequesting: boolean;
  hasConnection: boolean;
  connectionStatus: string;
}

const BlurredFinancialTeaser = ({ 
  onRequestConnection, 
  isRequesting, 
  hasConnection, 
  connectionStatus 
}: BlurredFinancialTeaserProps) => {
  // Don't show if already connected
  if (hasConnection && connectionStatus === "approved") {
    return null;
  }

  return (
    <Card className="relative overflow-hidden border-2 border-dashed border-muted-foreground/20 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          Detailed Financial Information
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {/* Blurred content preview */}
        <div className="space-y-6 blur-sm select-none pointer-events-none">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calculator className="h-4 w-4" />
                <span>Cash Flow Analysis</span>
              </div>
              <div className="h-3 bg-muted rounded w-24"></div>
              <div className="h-2 bg-muted rounded w-16"></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PieChart className="h-4 w-4" />
                <span>Profit Margins</span>
              </div>
              <div className="h-3 bg-muted rounded w-20"></div>
              <div className="h-2 bg-muted rounded w-14"></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span>Historical Performance</span>
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded w-full"></div>
              <div className="h-2 bg-muted rounded w-4/5"></div>
              <div className="h-2 bg-muted rounded w-3/4"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded"></div>
              <div className="h-2 bg-muted rounded w-3/4"></div>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded"></div>
              <div className="h-2 bg-muted rounded w-2/3"></div>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded"></div>
              <div className="h-2 bg-muted rounded w-4/5"></div>
            </div>
          </div>
        </div>

        {/* Overlay with call to action */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/70 to-background/30 flex items-center justify-center">
          <div className="text-center px-6 py-8">
            <div className="mb-4">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Unlock Detailed Financial Analysis</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Request a connection to access comprehensive financial data, historical performance, 
                cash flow analysis, and detailed business metrics.
              </p>
            </div>
            
            <Button
              onClick={onRequestConnection}
              disabled={isRequesting || hasConnection}
              className="group relative bg-gradient-to-r from-[#D7B65C] via-[#E5C76A] to-[#D7B65C] text-slate-900 border-0 hover:shadow-lg hover:shadow-[rgba(215,182,92,0.2)] hover:scale-[1.02] transition-all duration-300 ease-out active:scale-[0.98] px-8 py-2.5 text-sm font-semibold tracking-wide"
            >
              {/* Premium button effects */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#E5C76A] via-[#F0D478] to-[#E5C76A] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.15)] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-out" />
              
              <span className="relative flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {isRequesting ? "Sending Request..." : hasConnection ? "Request Sent" : "Request Connection"}
              </span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BlurredFinancialTeaser;