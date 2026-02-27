import { useParams } from 'react-router-dom';
import { useDealLandingPage, useRelatedDeals } from '@/hooks/useDealLandingPage';
import LandingHeader from './components/LandingHeader';
import DealHero from './components/DealHero';
import MetricsStrip from './components/MetricsStrip';
import ContentSections from './components/ContentSections';
import DealRequestForm from './components/DealRequestForm';
import DealSidebar from './components/DealSidebar';
import RelatedDeals from './components/RelatedDeals';

export default function DealLandingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: deal, isLoading, error } = useDealLandingPage(id);
  const { data: relatedDeals } = useRelatedDeals(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F5F0]">
        <LandingHeader />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C9A84C]" />
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="min-h-screen bg-[#F7F5F0]">
        <LandingHeader />
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-32 text-center">
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2 font-['Inter',system-ui,sans-serif]">
            Deal Not Found
          </h1>
          <p className="text-[#6B7280] font-['Inter',system-ui,sans-serif]">
            The deal you are looking for does not exist or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      <LandingHeader />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Hero */}
        <DealHero deal={deal} />

        {/* Metrics */}
        <MetricsStrip deal={deal} />

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Mobile sidebar (above content on mobile) */}
          <div className="lg:hidden">
            <DealSidebar executiveSummaryUrl={deal.executive_summary} />
          </div>

          {/* Left column — content + form */}
          <div className="w-full lg:w-[65%]">
            <ContentSections deal={deal} />
            <div className="mt-8 mb-8">
              <DealRequestForm listingId={deal.id} dealTitle={deal.title} />
            </div>
          </div>

          {/* Right column — sticky sidebar (desktop) */}
          <div className="hidden lg:block lg:w-[32%]">
            <div className="sticky top-20">
              <DealSidebar executiveSummaryUrl={deal.executive_summary} />
            </div>
          </div>
        </div>

        {/* Related Deals */}
        {relatedDeals && relatedDeals.length > 0 && <RelatedDeals deals={relatedDeals} />}
      </main>
    </div>
  );
}
