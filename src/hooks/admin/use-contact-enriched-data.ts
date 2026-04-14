/**
 * Fetches enriched data for a contact list member by looking up:
 * 1. The contact record (from contacts table by email)
 * 2. The associated buyer/company (from buyers table)
 * 3. Related deals (from deal_pipeline)
 * 4. Related connection requests
 * 5. Lead details (valuation_leads or inbound_leads)
 * 6. Firm agreement
 *
 * Extracted from ContactMemberDrawer.tsx for reusability and cleaner architecture.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ContactListMember } from '@/types/contact-list';

const BUYER_SELECT =
  'id, company_name, company_website, buyer_type, buyer_linkedin, hq_state, hq_city, target_revenue_min, target_revenue_max, target_geographies, target_services, thesis_summary, business_summary, pe_firm_name, acquisition_appetite, has_fee_agreement, industry_vertical, is_marketplace_member, buyer_tier';
const GENERIC_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];

export function useContactEnrichedData(member: ContactListMember | null) {
  const email = member?.contact_email || null;
  const entityType = member?.entity_type || null;
  const entityId = member?.entity_id || null;

  const { data: contactRecord, isLoading: contactLoading } = useQuery({
    queryKey: ['contact-member-detail', 'contact', email],
    queryFn: async () => {
      if (!email) return null;
      const { data, error } = await supabase
        .from('contacts')
        .select(
          'id, first_name, last_name, email, phone, linkedin_url, title, contact_type, firm_id, nda_signed, fee_agreement_signed, created_at, remarketing_buyer_id, listing_id, company_name',
        )
        .eq('email', email)
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[useContactEnrichedData] contacts lookup error:', error.message);
        return null;
      }
      return data;
    },
    enabled: !!email,
    staleTime: 30000,
  });

  const buyerId = contactRecord?.remarketing_buyer_id || null;
  const companyName = member?.contact_company || contactRecord?.company_name || null;
  const { data: buyerRecord, isLoading: buyerLoading } = useQuery({
    queryKey: ['contact-member-detail', 'buyer', buyerId, companyName, entityId, entityType],
    queryFn: async () => {
      if (buyerId) {
        const { data } = await supabase
          .from('buyers')
          .select(BUYER_SELECT)
          .eq('id', buyerId)
          .maybeSingle();
        if (data) return data;
      }
      if (
        entityId &&
        entityType &&
        ['lead', 'owner_lead', 'buyer', 'remarketing_buyer'].includes(entityType)
      ) {
        const { data } = await supabase
          .from('buyers')
          .select(BUYER_SELECT)
          .eq('id', entityId)
          .maybeSingle();
        if (data) return data;
      }
      if (companyName) {
        const { data } = await supabase
          .from('buyers')
          .select(BUYER_SELECT)
          .ilike('company_name', companyName)
          .eq('archived', false)
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }
      if (email) {
        const domain = email.split('@')[1];
        if (domain && !GENERIC_EMAIL_DOMAINS.includes(domain)) {
          const { data } = await supabase
            .from('buyers')
            .select(BUYER_SELECT)
            .eq('email_domain', domain)
            .eq('archived', false)
            .limit(1)
            .maybeSingle();
          if (data) return data;
        }
      }
      return null;
    },
    enabled: !!buyerId || !!companyName || !!entityId || !!email,
    staleTime: 30000,
  });

  const { data: relatedDeals = [] } = useQuery({
    queryKey: ['contact-member-detail', 'deals', email, entityId],
    queryFn: async () => {
      const results: Array<{
        id: string;
        title: string;
        contact_company: string | null;
        stage_id: string;
        priority: string | null;
        created_at: string | null;
        listing_id: string | null;
      }> = [];
      if (email) {
        const { data } = await supabase
          .from('deal_pipeline')
          .select(
            'id, title, contact_name, contact_company, stage_id, priority, created_at, listing_id',
          )
          .eq('contact_email', email)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(5);
        if (data) results.push(...data);
      }
      if (entityId && entityType === 'lead') {
        const { data } = await supabase
          .from('deal_pipeline')
          .select(
            'id, title, contact_name, contact_company, stage_id, priority, created_at, listing_id',
          )
          .eq('inbound_lead_id', entityId)
          .is('deleted_at', null)
          .limit(5);
        if (data) {
          const existingIds = new Set(results.map((r) => r.id));
          results.push(...data.filter((d) => !existingIds.has(d.id)));
        }
      }
      return results;
    },
    enabled: !!email || !!entityId,
    staleTime: 30000,
  });

  const { data: leadRecord } = useQuery({
    queryKey: ['contact-member-detail', 'lead', entityId, entityType],
    queryFn: async () => {
      if (!entityId) return null;
      const { data: vlData } = await supabase
        .from('valuation_leads')
        .select(
          'id, full_name, email, phone, business_name, website, industry, region, location, revenue, ebitda, valuation_low, valuation_mid, valuation_high, quality_tier, quality_label, exit_timing, lead_score, status, lead_source, calculator_type, growth_trend, buyer_lane, revenue_model, locations_count, pushed_listing_id, created_at',
        )
        .eq('id', entityId)
        .maybeSingle();
      if (vlData) {
        return {
          id: vlData.id,
          name: vlData.full_name,
          email: vlData.email,
          phone_number: vlData.phone,
          company_name: vlData.business_name,
          business_website: vlData.website,
          lead_type: vlData.calculator_type,
          status: vlData.status,
          source: vlData.lead_source,
          estimated_revenue_range: vlData.revenue
            ? `$${(vlData.revenue / 1_000_000).toFixed(1)}M`
            : null,
          sale_timeline: vlData.exit_timing,
          role: null as string | null,
          message: null as string | null,
          priority_score: vlData.lead_score,
          admin_notes: null as string | null,
          mapped_to_listing_title: null as string | null,
          created_at: vlData.created_at,
          industry: vlData.industry,
          region: vlData.region,
          location: vlData.location,
          revenue: vlData.revenue,
          ebitda: vlData.ebitda,
          valuation_low: vlData.valuation_low,
          valuation_mid: vlData.valuation_mid,
          valuation_high: vlData.valuation_high,
          quality_tier: vlData.quality_tier,
          quality_label: vlData.quality_label,
          growth_trend: vlData.growth_trend,
          buyer_lane: vlData.buyer_lane,
          revenue_model: vlData.revenue_model,
          locations_count: vlData.locations_count,
          pushed_listing_id: vlData.pushed_listing_id,
        };
      }
      const { data: ilData } = await supabase
        .from('inbound_leads')
        .select(
          'id, name, email, phone_number, company_name, business_website, lead_type, status, source, source_form_name, estimated_revenue_range, sale_timeline, role, message, priority_score, admin_notes, mapped_to_listing_title, created_at',
        )
        .eq('id', entityId)
        .maybeSingle();
      if (ilData)
        return {
          ...ilData,
          industry: null,
          region: null,
          location: null,
          revenue: null,
          ebitda: null,
          valuation_low: null,
          valuation_mid: null,
          valuation_high: null,
          quality_tier: null,
          quality_label: null,
          growth_trend: null,
          buyer_lane: null,
          revenue_model: null,
          locations_count: null,
          pushed_listing_id: null,
        };
      return null;
    },
    enabled: !!entityId && entityType === 'lead',
    staleTime: 30000,
  });

  const { data: connectionRequest } = useQuery({
    queryKey: ['contact-member-detail', 'cr', entityId, entityType],
    queryFn: async () => {
      if (!entityId) return null;
      const { data } = await supabase
        .from('connection_requests' as never)
        .select('id, status, created_at, buyer_type, company_name, services_needed')
        .eq('id', entityId)
        .maybeSingle();
      return data as Record<string, unknown> | null;
    },
    enabled: !!entityId && entityType === 'connection_request',
    staleTime: 30000,
  });

  const firmId = contactRecord?.firm_id || null;
  const { data: firmRecord } = useQuery({
    queryKey: ['contact-member-detail', 'firm', firmId],
    queryFn: async () => {
      if (!firmId) return null;
      const { data } = await supabase
        .from('firm_agreements')
        .select('id, primary_company_name, nda_signed, fee_agreement_signed, member_count')
        .eq('id', firmId)
        .maybeSingle();
      return data;
    },
    enabled: !!firmId,
    staleTime: 30000,
  });

  return {
    contactRecord,
    buyerRecord,
    relatedDeals,
    leadRecord,
    connectionRequest,
    firmRecord,
    isLoading: contactLoading || buyerLoading,
  };
}

export function formatRevenue(min: number | null, max: number | null): string {
  const fmt = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(0)}M` : `$${(v / 1_000).toFixed(0)}K`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return '—';
}

export function formatBuyerType(type: string | null): string {
  if (!type) return '—';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
