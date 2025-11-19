import { ArrowRight, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InterestSidebarProps {
  onRequestDetails: () => void;
  onBrowseMarketplace: () => void;
}

export function InterestSidebar({ onRequestDetails, onBrowseMarketplace }: InterestSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Main CTA Card */}
      <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-950 mb-2">
          Interested in This Deal?
        </h3>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          Request full deal details including financials, operations overview, and investment thesis.
        </p>
        <Button
          onClick={onRequestDetails}
          className="w-full h-12 text-base font-semibold bg-[#D8B75D] hover:bg-[#C9A84D] text-slate-950 rounded-lg shadow-sm"
        >
          Request Full Deal Details
        </Button>
      </div>

      {/* Exclusive Deal Flow Card */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
        <h4 className="text-sm font-bold text-slate-950 uppercase tracking-wider mb-3">
          Exclusive Deal Flow
        </h4>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          Get early access to off-market opportunities before they're widely distributed. Premium deal flow for qualified buyers.
        </p>
        <button
          onClick={onBrowseMarketplace}
          className="flex items-center gap-2 text-sm font-semibold text-[#D8B75D] hover:text-[#C9A84D] transition-colors group"
        >
          <span>Browse Marketplace</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Deal Presented By Card */}
      <div className="bg-white rounded-xl border border-slate-200/60 p-6 shadow-sm">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
          DEAL PRESENTED BY
        </div>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-950 mb-0.5">
              SourceCo Team
            </div>
            <div className="text-sm text-slate-600 mb-3">
              Investment Banking
            </div>
            <div className="space-y-2">
              <a
                href="tel:+1234567890"
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-950 transition-colors group"
              >
                <Phone className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                <span>+1 (234) 567-8900</span>
              </a>
              <a
                href="mailto:deals@sourceco.com"
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-950 transition-colors group"
              >
                <Mail className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                <span>deals@sourceco.com</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
