import { ExternalLink, Download } from 'lucide-react';

interface DealSidebarProps {
  executiveSummaryUrl?: string | null;
}

export default function DealSidebar({ executiveSummaryUrl }: DealSidebarProps) {
  const scrollToForm = () => {
    const el = document.getElementById('request');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <aside className="space-y-6">
      {/* Interested Panel */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
        <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-1 font-['Inter',system-ui,sans-serif]">
          Interested in This Deal?
        </h3>
        <p className="text-[14px] text-[#6B7280] mb-4 font-['Inter',system-ui,sans-serif]">
          Get full access to detailed financials and business metrics
        </p>

        <div className="space-y-2">
          <button
            onClick={scrollToForm}
            className="w-full bg-[#C9A84C] text-[#1A1A1A] font-semibold text-[15px] py-3 rounded-md hover:bg-[#b8963e] transition-colors font-['Inter',system-ui,sans-serif]"
          >
            Request Full Deal Details
          </button>

          <a
            href="https://tidycal.com/tomosmughan/30-minute-meeting"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-white border border-[#1A1A1A] text-[#1A1A1A] font-semibold text-[15px] py-3 rounded-md hover:bg-gray-50 transition-colors font-['Inter',system-ui,sans-serif]"
          >
            <ExternalLink className="w-4 h-4" />
            Schedule Buyer Call
          </a>

          {executiveSummaryUrl && (
            <a
              href={executiveSummaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-white border border-[#1A1A1A] text-[#1A1A1A] font-semibold text-[15px] py-3 rounded-md hover:bg-gray-50 transition-colors font-['Inter',system-ui,sans-serif]"
            >
              <Download className="w-4 h-4" />
              Download Executive Summary
            </a>
          )}
        </div>
      </div>

      {/* Exclusive Deal Flow Panel */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
        <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-2 font-['Inter',system-ui,sans-serif]">
          Exclusive Deal Flow
        </h3>
        <p className="text-[13px] text-[#6B7280] leading-[1.6] mb-4 font-['Inter',system-ui,sans-serif]">
          Access 50+ vetted founder-led businesses with $2M-50M revenue. Off-market opportunities
          from our proprietary network.
        </p>
        <a
          href="https://marketplace.sourcecodeals.com/signup"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-white border border-[#1A1A1A] text-[#1A1A1A] font-semibold text-[14px] py-2.5 rounded-md hover:bg-gray-50 transition-colors font-['Inter',system-ui,sans-serif]"
        >
          <ExternalLink className="w-4 h-4" />
          Browse Marketplace
        </a>
      </div>

      {/* Deal Presented By */}
      <div className="pt-4 border-t border-[#E5E7EB]">
        <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.08em] mb-4 font-['Inter',system-ui,sans-serif]">
          Deal Presented By
        </p>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-[#E5E7EB] flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img
              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png"
              alt="Tomos Mughan"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
              Tomos Mughan
            </p>
            <p className="text-[13px] text-[#6B7280] font-['Inter',system-ui,sans-serif]">
              CEO, SourceCo
            </p>
            <a
              href="tel:+16143162342"
              className="block text-[13px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors mt-1 font-['Inter',system-ui,sans-serif]"
            >
              +1 (614) 316-2342
            </a>
            <a
              href="mailto:tomos.mughan@sourcecodeals.com"
              className="block text-[13px] text-[#6B7280] hover:text-[#1A1A1A] transition-colors font-['Inter',system-ui,sans-serif]"
            >
              tomos.mughan@sourcecodeals.com
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
