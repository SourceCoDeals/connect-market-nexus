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
    website: deal.website ?? null,
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

function AnonymizedContent({ text, dealData }: { text: string; dealData: DealData }) {
  const anonymized = stripIdentifyingInfo(text, dealData);
  return (
    <p className="text-sm leading-relaxed text-[#374151] font-['Inter',system-ui,sans-serif] whitespace-pre-line">
      {anonymized}
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

  const customSections = deal.custom_sections ?? [];

  return (
    <div>
      {/* Business Overview — the description, same as listing page */}
      {(deal.description_html || deal.description) && (
        <CollapsibleSection title="Business Overview">
          <div className="prose prose-slate max-w-none text-sm [&_p]:text-sm [&_div]:text-sm [&_span]:text-sm">
            {deal.description_html ? (
              <RichTextDisplay content={anon(deal.description_html)} />
            ) : (
              <AnonymizedContent text={deal.description!} dealData={dealData} />
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Custom Sections — the lead memo content sections, same as listing page */}
      {customSections.map((section, i) => (
        <CollapsibleSection key={i} title={anon(section.title)}>
          <AnonymizedContent text={section.description} dealData={dealData} />
        </CollapsibleSection>
      ))}
    </div>
  );
}
