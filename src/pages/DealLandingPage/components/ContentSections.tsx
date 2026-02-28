import { User } from 'lucide-react';
import type { LandingPageDeal } from '@/hooks/useDealLandingPage';

interface ContentSectionsProps {
  deal: LandingPageDeal;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-6 border-b border-[#E5E7EB] last:border-b-0">
      <h2 className="text-[18px] sm:text-[20px] font-semibold text-[#1A1A1A] mb-3 font-['Inter',system-ui,sans-serif]">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  return (
    <p className="text-[15px] leading-[1.6] text-[#374151] font-['Inter',system-ui,sans-serif]">
      {text}
    </p>
  );
}

export default function ContentSections({ deal }: ContentSectionsProps) {
  // Parse custom_sections from the deal data
  const customSections = deal.custom_sections ?? [];

  // Find specific sections by common title patterns
  const findSection = (patterns: string[]) =>
    customSections.find((s) =>
      patterns.some((p) => s.title.toLowerCase().includes(p.toLowerCase())),
    );

  const strategicAssets = findSection(['strategic asset', 'strategic']);
  const revenueQuality = findSection(['revenue quality', 'revenue']);
  const growthSection = findSection(['growth', 'acceleration', 'opportunity']);

  // Filter out sections that are already handled by dedicated fields or matched above
  const matchedTitles = new Set(
    [strategicAssets, revenueQuality, growthSection].filter(Boolean).map((s) => s!.title),
  );
  const additionalSections = customSections.filter((s) => !matchedTitles.has(s.title));

  return (
    <div>
      {/* Investment Thesis */}
      {deal.investment_thesis && (
        <Section title="Investment Thesis">
          <Paragraph text={deal.investment_thesis} />
        </Section>
      )}

      {/* Strategic Assets */}
      {strategicAssets && (
        <Section title={strategicAssets.title}>
          <Paragraph text={strategicAssets.description} />
        </Section>
      )}

      {/* Revenue Quality */}
      {revenueQuality && (
        <Section title={revenueQuality.title}>
          <Paragraph text={revenueQuality.description} />
        </Section>
      )}

      {/* Growth Acceleration Opportunity */}
      {growthSection && (
        <Section title={growthSection.title}>
          <Paragraph text={growthSection.description} />
        </Section>
      )}

      {/* Additional custom sections */}
      {additionalSections.map((section, i) => (
        <Section key={i} title={section.title}>
          <Paragraph text={section.description} />
        </Section>
      ))}

      {/* Core Service Offerings */}
      {deal.services && deal.services.length > 0 && (
        <Section title="Core Service Offerings">
          <ul className="list-disc list-inside space-y-1.5">
            {deal.services.map((service, i) => (
              <li
                key={i}
                className="text-[15px] leading-[1.6] text-[#374151] font-['Inter',system-ui,sans-serif]"
              >
                {service}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Ownership Section */}
      {(deal.ownership_structure || deal.seller_motivation) && (
        <div className="my-6 bg-[#FAF8F5] rounded-xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-[#E5E7EB] flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-[#9CA3AF]" />
            </div>
            <div>
              {deal.ownership_structure && (
                <p className="text-[16px] font-semibold text-[#1A1A1A] mb-1 font-['Inter',system-ui,sans-serif]">
                  {deal.ownership_structure}
                </p>
              )}
              {deal.seller_motivation && (
                <p className="text-[15px] leading-[1.6] text-[#374151] font-['Inter',system-ui,sans-serif]">
                  {deal.seller_motivation}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
