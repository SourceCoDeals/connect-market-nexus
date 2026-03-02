import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LandingPageDeal } from '@/hooks/useDealLandingPage';
import { stripIdentifyingInfo, type DealData } from '@/lib/deal-to-listing-anonymizer';
import { RichTextDisplay } from '@/components/ui/rich-text-display';

interface ContentSectionsProps {
  deal: LandingPageDeal;
}

/**
 * Build a minimal DealData object from the landing page listing data
 * so we can reuse stripIdentifyingInfo for anonymization.
 */
function buildDealDataForAnonymization(deal: LandingPageDeal): DealData {
  return {
    id: deal.id,
    title: deal.title,
    internal_company_name: deal.internal_company_name ?? null,
    executive_summary: null,
    description: null,
    revenue: deal.revenue,
    ebitda: deal.ebitda,
    location: deal.location,
    address_state: null,
    address_city: null,
    category: deal.category ?? deal.categories?.[0] ?? null,
    industry: null,
    service_mix: null,
    website: deal.company_website ?? null,
    full_time_employees: deal.full_time_employees,
    linkedin_employee_count: null,
    main_contact_name: null,
    main_contact_email: null,
    main_contact_phone: null,
    main_contact_title: null,
    geographic_states: null,
    internal_deal_memo_link: null,
  };
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[#E5E7EB] last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-5 text-left group"
      >
        <h2 className="text-sm font-medium text-[#1A1A1A] leading-5 font-['Inter',system-ui,sans-serif]">
          {title}
        </h2>
        <ChevronDown
          className={`w-4 h-4 text-[#9CA3AF] transition-transform duration-200 flex-shrink-0 ml-4 ${
            isOpen ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </button>
      {isOpen && <div className="pb-6">{children}</div>}
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  return (
    <p className="text-sm leading-relaxed text-[#374151] font-['Inter',system-ui,sans-serif]">
      {text}
    </p>
  );
}

export default function ContentSections({ deal }: ContentSectionsProps) {
  const dealData = useMemo(() => buildDealDataForAnonymization(deal), [deal]);

  /** Anonymize a text value using the same engine as the lead memo */
  const anon = (text: string | null | undefined): string => {
    if (!text) return '';
    return stripIdentifyingInfo(text, dealData);
  };

  // Normalize arrays
  const growthDrivers = Array.isArray(deal.growth_drivers) ? deal.growth_drivers : [];
  const keyRisks = Array.isArray(deal.key_risks) ? deal.key_risks : [];
  const customSections = deal.custom_sections ?? [];
  const revenueBreakdown = deal.revenue_model_breakdown ?? {};
  const hasRevenueBreakdown = Object.keys(revenueBreakdown).length > 0;

  return (
    <div>
      {/* Revenue Composition — mirrors EnhancedInvestorDashboard */}
      {hasRevenueBreakdown && (
        <CollapsibleSection title="Revenue Composition">
          <div className="space-y-3">
            {Object.entries(revenueBreakdown).map(([type, percentage]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-sm text-[#374151] capitalize font-['Inter',system-ui,sans-serif]">
                  {type.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-medium text-[#1A1A1A] font-['Inter',system-ui,sans-serif]">
                  {percentage}%
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Investment Thesis — matches listing page */}
      {deal.investment_thesis && (
        <CollapsibleSection title="Investment Thesis">
          <Paragraph text={anon(deal.investment_thesis)} />
        </CollapsibleSection>
      )}

      {/* Growth Catalysts — matches listing page */}
      {growthDrivers.length > 0 && (
        <CollapsibleSection title="Growth Catalysts">
          <div className="space-y-2">
            {growthDrivers.map((driver, i) => (
              <div key={i} className="text-sm text-[#374151] font-['Inter',system-ui,sans-serif]">
                &bull; {anon(driver)}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Risk Factors — matches listing page */}
      {keyRisks.length > 0 && (
        <CollapsibleSection title="Risk Factors" defaultOpen={false}>
          <div className="space-y-2">
            {keyRisks.map((risk, i) => (
              <div key={i} className="text-sm text-[#374151] font-['Inter',system-ui,sans-serif]">
                &bull; {anon(risk)}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Business Overview — matches listing page description section */}
      {(deal.description_html || deal.description) && (
        <CollapsibleSection title="Business Overview">
          <div className="prose prose-slate max-w-none text-sm [&_p]:text-sm [&_div]:text-sm [&_span]:text-sm">
            {deal.description_html ? (
              <RichTextDisplay content={anon(deal.description_html)} />
            ) : (
              <Paragraph text={anon(deal.description)} />
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Ownership & Transaction Overview — matches listing page */}
      {(deal.ownership_structure || deal.seller_motivation) && (
        <CollapsibleSection title="Ownership & Transaction Overview">
          <div className="bg-[#FAF8F5] rounded-lg p-5 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-[#E5E7EB] flex-shrink-0">
                <div className="w-7 h-7 bg-[#C9A84C] rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-[9px]">CEO</span>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                {deal.ownership_structure && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#1A1A1A] mb-1 font-['Inter',system-ui,sans-serif]">
                      Current Ownership Structure
                    </h4>
                    <p className="text-sm text-[#374151] leading-relaxed font-['Inter',system-ui,sans-serif]">
                      {anon(deal.ownership_structure)}
                    </p>
                  </div>
                )}
                {deal.seller_motivation && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#1A1A1A] mb-1 font-['Inter',system-ui,sans-serif]">
                      Transaction Motivation
                    </h4>
                    <p className="text-sm text-[#374151] leading-relaxed font-['Inter',system-ui,sans-serif]">
                      {anon(deal.seller_motivation)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Transaction Preferences — matches listing page */}
      {(deal.seller_motivation || deal.timeline_preference || deal.seller_involvement_preference) && (
        <CollapsibleSection title="Transaction Preferences" defaultOpen={false}>
          <div className="space-y-4">
            {deal.seller_motivation && (
              <div className="space-y-1">
                <span className="text-xs text-[#6B7280] uppercase tracking-wider font-['Inter',system-ui,sans-serif]">
                  Seller Motivation
                </span>
                <p className="text-sm text-[#374151] font-['Inter',system-ui,sans-serif]">
                  {anon(deal.seller_motivation)}
                </p>
              </div>
            )}
            {deal.timeline_preference && (
              <div className="space-y-1">
                <span className="text-xs text-[#6B7280] uppercase tracking-wider font-['Inter',system-ui,sans-serif]">
                  Timeline Preference
                </span>
                <p className="text-sm text-[#374151] font-['Inter',system-ui,sans-serif]">
                  {anon(deal.timeline_preference)}
                </p>
              </div>
            )}
            {deal.seller_involvement_preference && (
              <div className="space-y-1">
                <span className="text-xs text-[#6B7280] uppercase tracking-wider font-['Inter',system-ui,sans-serif]">
                  Post-Sale Role
                </span>
                <p className="text-sm text-[#374151] font-['Inter',system-ui,sans-serif]">
                  {anon(deal.seller_involvement_preference)}
                </p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Custom Sections — matches listing page */}
      {customSections.length > 0 &&
        customSections.map((section, i) => (
          <CollapsibleSection key={i} title={anon(section.title)}>
            <Paragraph text={anon(section.description)} />
          </CollapsibleSection>
        ))}

      {/* Core Service Offerings */}
      {deal.services && deal.services.length > 0 && (
        <CollapsibleSection title="Core Service Offerings">
          <div className="space-y-2">
            {deal.services.map((service, i) => (
              <div
                key={i}
                className="text-sm text-[#374151] font-['Inter',system-ui,sans-serif]"
              >
                &bull; {anon(service)}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Market Position & Competitive Landscape */}
      {(deal.competitive_position || deal.end_market_description) && (
        <CollapsibleSection title="Market Position & Competitive Landscape" defaultOpen={false}>
          {deal.competitive_position && (
            <Paragraph text={anon(deal.competitive_position)} />
          )}
          {deal.end_market_description && deal.competitive_position && (
            <div className="mt-3" />
          )}
          {deal.end_market_description && (
            <Paragraph text={anon(deal.end_market_description)} />
          )}
        </CollapsibleSection>
      )}
    </div>
  );
}
