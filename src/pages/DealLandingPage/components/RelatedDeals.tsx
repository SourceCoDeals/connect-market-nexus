import { MapPin, ArrowRight, ExternalLink } from 'lucide-react';
import type { RelatedDeal } from '@/hooks/useDealLandingPage';

function formatCurrency(value: number | null | undefined): string {
  if (!value) return '—';
  if (value >= 1_000_000_000) return `~$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `~$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `~$${Math.round(value / 1_000).toLocaleString()}K`;
  return `~$${value.toLocaleString()}`;
}

interface RelatedDealsProps {
  deals: RelatedDeal[];
}

export default function RelatedDeals({ deals }: RelatedDealsProps) {
  if (deals.length === 0) return null;

  return (
    <section className="py-12 sm:py-16">
      <h2 className="text-[24px] font-bold text-[#1A1A1A] mb-2 font-['Inter',system-ui,sans-serif]">
        Access more off-market deals like this one
      </h2>
      <p className="text-[15px] text-[#6B7280] leading-[1.6] mb-8 max-w-2xl font-['Inter',system-ui,sans-serif]">
        Browse pre-vetted, founder-led deals that fit your unique criteria. See deals in auto,
        industrials, SaaS, healthcare and more on our founder-deal marketplace.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>

      {/* Marketplace CTA below related deals */}
      <div className="mt-8 text-center">
        <a
          href="https://marketplace.sourcecodeals.com/signup?utm_source=landing_page&utm_medium=related_deals&utm_content=browse_all"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#1A1A1A] text-white font-semibold text-[15px] px-8 py-3.5 rounded-md hover:bg-[#333333] transition-colors font-['Inter',system-ui,sans-serif]"
        >
          <ExternalLink className="w-4 h-4" />
          Browse All Deals on the Marketplace
        </a>
      </div>
    </section>
  );
}

function DealCard({ deal }: { deal: RelatedDeal }) {
  const marginStr = deal.ebitda_margin ? `${Math.round(deal.ebitda_margin)}% EBITDA Margin` : null;
  const industry = deal.categories?.[0] || null;
  const description = deal.hero_description || deal.description || '';
  // Truncate description to ~200 chars
  const shortDesc = description.length > 200 ? description.slice(0, 200) + '...' : description;

  return (
    <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5 flex flex-col">
      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        {marginStr && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#C9A84C] text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
            {marginStr}
          </span>
        )}
        {industry && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#E5E7EB] text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
            {industry}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-[18px] font-bold text-[#1A1A1A] mb-2 font-['Inter',system-ui,sans-serif]">
        {deal.title}
      </h3>

      {/* Location */}
      {deal.location && (
        <div className="flex items-center gap-1 text-[#6B7280] mb-3">
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-[12px] uppercase tracking-wide font-['Inter',system-ui,sans-serif]">
            {deal.location}
          </span>
        </div>
      )}

      {/* Description */}
      <p className="text-[14px] leading-[1.6] text-[#374151] mb-4 flex-grow font-['Inter',system-ui,sans-serif]">
        {shortDesc}
      </p>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-[#E5E7EB]">
        <div>
          <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.08em] font-['Inter',system-ui,sans-serif]">
            Annual Revenue
          </p>
          <p className="text-[16px] font-bold text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
            {formatCurrency(deal.revenue)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.08em] font-['Inter',system-ui,sans-serif]">
            Annual EBITDA
          </p>
          <p className="text-[16px] font-bold text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
            {formatCurrency(deal.ebitda)}
          </p>
        </div>
      </div>

      {/* GAP 15: Link to deal landing page instead of external signup */}
      <a
        href={`/deals/${deal.id}`}
        className="flex items-center justify-center gap-2 w-full bg-white border border-[#1A1A1A] text-[#1A1A1A] font-semibold text-[14px] py-2.5 rounded-md hover:bg-gray-50 transition-colors font-['Inter',system-ui,sans-serif]"
      >
        <ArrowRight className="w-4 h-4" />
        View Deal Details
      </a>
    </div>
  );
}
