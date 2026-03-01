import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ImprovedListingEditor } from '@/components/admin/ImprovedListingEditor';
import { useRobustListingCreation } from '@/hooks/admin/listings/use-robust-listing-creation';
import { useGenerateListingContent } from '@/hooks/admin/listings/use-generate-listing-content';
import { anonymizeDealToListing } from '@/lib/deal-to-listing-anonymizer';
import { AdminListing } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Page for creating a marketplace listing from a deal in the marketplace queue.
 * Fetches deal data, anonymizes it, and pre-fills the listing editor.
 */
export default function CreateListingFromDeal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dealId = searchParams.get('fromDeal');

  const { mutateAsync: createListing, isPending: isCreating } = useRobustListingCreation();
  const { generateContent, isGenerating } = useGenerateListingContent();
  const [aiApplied, setAiApplied] = useState(false);

  // Fetch the deal data
  const {
    data: deal,
    isLoading: dealLoading,
    error: dealError,
  } = useQuery({
    queryKey: ['marketplace-queue-deal', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(
          `
          id, title, internal_company_name, description, executive_summary,
          revenue, ebitda, ebitda_margin, location, address_state, address_city,
          category, industry, service_mix, services, website,
          full_time_employees, linkedin_employee_count,
          main_contact_name, main_contact_email, main_contact_phone, main_contact_title,
          geographic_states, internal_deal_memo_link,
          pushed_to_marketplace,
          customer_geography, customer_types,
          business_model, revenue_model, end_market_description,
          competitive_position, ownership_structure, seller_motivation,
          owner_goals, transition_preferences, growth_drivers,
          investment_thesis, founded_year, number_of_locations,
          linkedin_specialties
        `,
        )
        .eq('id', dealId!)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Check if a listing already exists for this deal
  const { data: existingListing } = useQuery({
    queryKey: ['existing-listing-for-deal', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title')
        .eq('source_deal_id', dealId!)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Build the pre-filled listing from anonymized deal data
  const [prefilled, setPrefilled] = useState<AdminListing | null>(null);

  useEffect(() => {
    if (deal && !prefilled) {
      const anonymized = anonymizeDealToListing(deal as any);
      setPrefilled({
        id: '', // New listing, no ID yet
        title: anonymized.title,
        description: anonymized.description,
        hero_description: anonymized.hero_description,
        categories: anonymized.categories,
        location: anonymized.location,
        revenue: anonymized.revenue,
        ebitda: anonymized.ebitda,
        ebitda_margin: anonymized.ebitda_margin,
        full_time_employees: anonymized.full_time_employees,
        internal_company_name: anonymized.internal_company_name,
        internal_notes: anonymized.internal_notes,
        internal_deal_memo_link: (deal as any).internal_deal_memo_link || '',
        // Landing page content fields (GAPs 4+7)
        investment_thesis: anonymized.investment_thesis,
        custom_sections: anonymized.custom_sections,
        services: anonymized.services,
        growth_drivers: anonymized.growth_drivers,
        ownership_structure: anonymized.ownership_structure,
        seller_motivation: anonymized.seller_motivation,
        business_model: anonymized.business_model,
        customer_geography: anonymized.customer_geography,
        customer_types: anonymized.customer_types,
        revenue_model: anonymized.revenue_model,
        end_market_description: anonymized.end_market_description,
        competitive_position: anonymized.competitive_position,
        // Custom metrics (GAP 6)
        metric_3_type: anonymized.metric_3_type,
        metric_3_custom_label: anonymized.metric_3_custom_label,
        metric_3_custom_value: anonymized.metric_3_custom_value,
        metric_3_custom_subtitle: anonymized.metric_3_custom_subtitle,
        metric_4_type: anonymized.metric_4_type,
        metric_4_custom_label: anonymized.metric_4_custom_label,
        metric_4_custom_value: anonymized.metric_4_custom_value,
        metric_4_custom_subtitle: anonymized.metric_4_custom_subtitle,
        tags: [],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as AdminListing);
    }
  }, [deal, prefilled]);

  // Once we have the prefilled base data, automatically run AI generation
  // using the deal's transcripts, notes, and enrichment. This replaces the
  // manual "Generate All with AI" step so the editor opens ready to review.
  useEffect(() => {
    if (prefilled && dealId && !aiApplied && !isGenerating) {
      setAiApplied(true); // prevent double-fire
      generateContent(dealId).then((content) => {
        if (!content) return;
        setPrefilled((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            title: content.title_options?.[0] || prev.title,
            hero_description: content.hero_description || prev.hero_description,
            description: content.description || prev.description,
            investment_thesis: content.investment_thesis || prev.investment_thesis,
            custom_sections: content.custom_sections || prev.custom_sections,
            services: content.services || prev.services,
            growth_drivers: content.growth_drivers || prev.growth_drivers,
            competitive_position: content.competitive_position || prev.competitive_position,
            ownership_structure: content.ownership_structure || prev.ownership_structure,
            seller_motivation: content.seller_motivation || prev.seller_motivation,
            business_model: content.business_model || prev.business_model,
            customer_geography: content.customer_geography || prev.customer_geography,
            customer_types: content.customer_types || prev.customer_types,
            revenue_model: content.revenue_model || prev.revenue_model,
            end_market_description: content.end_market_description || prev.end_market_description,
          } as AdminListing;
        });
        toast.success('AI content generated — review and adjust as needed.');
      });
    }
  }, [prefilled, dealId, aiApplied, isGenerating, generateContent]);

  const handleSubmit = async (data: any, image?: File | null) => {
    try {
      const listingData = {
        ...data,
        source_deal_id: dealId,
        // Ensure it's created as an internal draft
        is_internal_deal: true,
      };

      await createListing({ listing: listingData, image });

      // Invalidate relevant queries — the deal stays in the queue so the
      // "Listing Created" badge appears. The source_deal_id link is the
      // canonical record that a listing exists for this deal.
      if (dealId) {
        queryClient.invalidateQueries({ queryKey: ['marketplace-queue'] });
        queryClient.invalidateQueries({ queryKey: ['marketplace-queue-existing-listings'] });
        queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
        queryClient.invalidateQueries({ queryKey: ['remarketing', 'deal', dealId] });
        queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      }

      toast.success('Marketplace listing created — review and publish from the Listings tab.');
      navigate('/admin/marketplace/queue');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create listing');
    }
  };

  if (!dealId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">
          No deal specified. Go back to the marketplace queue.
        </p>
        <Button variant="outline" onClick={() => navigate('/admin/marketplace/queue')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Queue
        </Button>
      </div>
    );
  }

  if (dealLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (dealError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="h-12 w-12 text-red-400" />
        <p className="text-muted-foreground">Failed to load deal data.</p>
        <Button variant="outline" onClick={() => navigate('/admin/marketplace/queue')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Queue
        </Button>
      </div>
    );
  }

  if (existingListing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-400" />
        <p className="text-muted-foreground">
          A listing already exists for this deal: <strong>{existingListing.title}</strong>
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/admin/marketplace/queue')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Queue
          </Button>
          <Button onClick={() => navigate(`/admin/deals?tab=marketplace`)}>
            View Existing Listing
          </Button>
        </div>
      </div>
    );
  }

  if (!prefilled || isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isGenerating ? 'AI is generating listing content from transcripts and notes…' : 'Loading deal data…'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-[1920px] mx-auto px-12 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/marketplace/queue')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Queue
          </Button>
          <div className="text-sm text-muted-foreground">
            Creating anonymous listing from:{' '}
            <strong>{(deal as any)?.internal_company_name || 'Unknown Deal'}</strong>
          </div>
        </div>
      </div>
      <ImprovedListingEditor listing={prefilled} onSubmit={handleSubmit} isLoading={isCreating} />
    </div>
  );
}
