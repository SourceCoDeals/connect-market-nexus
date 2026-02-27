import { MapPin } from 'lucide-react';
import type { LandingPageDeal } from '@/hooks/useDealLandingPage';

interface DealHeroProps {
  deal: LandingPageDeal;
}

export default function DealHero({ deal }: DealHeroProps) {
  return (
    <section className="pt-10 pb-6">
      <div className="flex items-center gap-4 mb-4">
        {deal.deal_identifier && (
          <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.08em] font-['Inter',system-ui,sans-serif]">
            {deal.deal_identifier}
          </span>
        )}
        <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.08em] font-['Inter',system-ui,sans-serif]">
          CONFIDENTIAL
        </span>
      </div>

      <h1 className="text-[32px] sm:text-[36px] font-bold text-[#1A1A1A] leading-tight mb-4 font-['Inter',system-ui,sans-serif]">
        {deal.title}
      </h1>

      {deal.location && (
        <div className="flex items-center gap-1.5 text-[#6B7280] mb-4">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-['Inter',system-ui,sans-serif]">{deal.location}</span>
        </div>
      )}

      {deal.hero_description && (
        <p className="text-[15px] leading-[1.6] text-[#374151] max-w-2xl font-['Inter',system-ui,sans-serif]">
          {deal.hero_description}
        </p>
      )}
    </section>
  );
}
