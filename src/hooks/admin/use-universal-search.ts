import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDeals } from './use-deals';
import { useListingsQuery } from './listings/use-listings-query';
import { useInboundLeadsQuery } from './use-inbound-leads';
import { useOwnerLeads } from './use-owner-leads';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// --------------- Result types ---------------

export type SearchResultCategory =
  | 'deal'
  | 'listing'
  | 'captarget'
  | 'gp_partner'
  | 'valuation_lead'
  | 'inbound_lead'
  | 'owner_lead'
  | 'referral_partner'
  | 'buyer';

export interface SearchResult {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
}

// --------------- Category labels & config ---------------

export const CATEGORY_CONFIG: Record<
  SearchResultCategory,
  { label: string; pluralLabel: string; color: string }
> = {
  deal: { label: 'Deal', pluralLabel: 'Deals', color: 'text-blue-600' },
  listing: { label: 'Listing', pluralLabel: 'Listings (All Deals)', color: 'text-emerald-600' },
  captarget: { label: 'CapTarget', pluralLabel: 'CapTarget Deals', color: 'text-orange-600' },
  gp_partner: { label: 'GP Partner', pluralLabel: 'GP Partner Deals', color: 'text-purple-600' },
  valuation_lead: { label: 'Valuation Lead', pluralLabel: 'Valuation Leads', color: 'text-cyan-600' },
  inbound_lead: { label: 'Inbound Lead', pluralLabel: 'Inbound Leads', color: 'text-amber-600' },
  owner_lead: { label: 'Owner Lead', pluralLabel: 'Owner/Seller Leads', color: 'text-rose-600' },
  referral_partner: { label: 'Referral', pluralLabel: 'Referral Partners', color: 'text-teal-600' },
  buyer: { label: 'Buyer', pluralLabel: 'Buyers', color: 'text-indigo-600' },
};

// --------------- Matching helper ---------------

function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(q));
}

// --------------- Supplementary data hooks ---------------

function useCapTargetDeals() {
  return useQuery({
    queryKey: ['universal-search', 'captarget-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(
          'id, title, internal_company_name, captarget_client_name, main_contact_name, main_contact_email, website, deal_source, status, created_at'
        )
        .eq('deal_source', 'captarget')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useGPPartnerDealsSearch() {
  return useQuery({
    queryKey: ['universal-search', 'gp-partner-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(
          'id, title, internal_company_name, main_contact_name, main_contact_email, website, deal_source, status, created_at'
        )
        .eq('deal_source', 'gp_partner')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useValuationLeadsSearch() {
  return useQuery({
    queryKey: ['universal-search', 'valuation-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('valuation_leads')
        .select(
          'id, display_name, full_name, business_name, email, website, industry, location, calculator_type, created_at, pushed_listing_id'
        )
        .eq('excluded', false)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useReferralPartnersSearch() {
  return useQuery({
    queryKey: ['universal-search', 'referral-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_partners')
        .select('id, name, company, email, phone, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function useBuyersSearch() {
  return useQuery({
    queryKey: ['universal-search', 'buyers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, company, buyer_type, approval_status')
        .eq('role', 'buyer')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// --------------- Main hook ---------------

const MAX_RESULTS_PER_CATEGORY = 5;
const DEBOUNCE_MS = 200;

export function useUniversalSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce the search query
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  // Data sources — these re-use existing cached queries where possible
  const { data: deals } = useDeals();
  const { data: listings } = useListingsQuery('all');
  const { data: inboundLeads } = useInboundLeadsQuery();
  const { data: ownerLeads } = useOwnerLeads();
  const { data: captargetDeals } = useCapTargetDeals();
  const { data: gpPartnerDeals } = useGPPartnerDealsSearch();
  const { data: valuationLeads } = useValuationLeadsSearch();
  const { data: referralPartners } = useReferralPartnersSearch();
  const { data: buyers } = useBuyersSearch();

  const isLoading = !deals && !listings && !inboundLeads;

  const results = useMemo<SearchResult[]>(() => {
    const q = debouncedQuery;
    if (!q || q.length < 2) return [];

    const all: SearchResult[] = [];

    // 1. Deals
    if (deals) {
      let count = 0;
      for (const d of deals) {
        if (count >= MAX_RESULTS_PER_CATEGORY) break;
        if (
          matchesQuery(
            q,
            d.title,
            d.listing_title,
            d.listing_real_company_name,
            d.contact_name,
            d.contact_email,
            d.contact_company,
            d.buyer_name,
            d.buyer_email,
            d.buyer_company,
            d.stage_name
          )
        ) {
          all.push({
            id: d.deal_id,
            category: 'deal',
            title: d.title || d.listing_title || 'Untitled Deal',
            subtitle: [d.buyer_name || d.contact_name, d.stage_name].filter(Boolean).join(' · '),
            meta: d.listing_real_company_name || d.contact_company || undefined,
            href: `/admin/deals/pipeline`,
          });
          count++;
        }
      }
    }

    // 2. Listings (All Deals)
    if (listings) {
      let count = 0;
      // Exclude captarget / gp_partner to avoid duplicates — they have their own categories
      const captargetIds = new Set((captargetDeals ?? []).map((d) => d.id));
      const gpIds = new Set((gpPartnerDeals ?? []).map((d) => d.id));
      for (const l of listings) {
        if (count >= MAX_RESULTS_PER_CATEGORY) break;
        if (captargetIds.has(l.id) || gpIds.has(l.id)) continue;
        if (
          matchesQuery(q, l.title, l.description, l.location, l.category, l.tags?.join(' '))
        ) {
          all.push({
            id: l.id,
            category: 'listing',
            title: l.title || 'Untitled Listing',
            subtitle: [l.location, l.category].filter(Boolean).join(' · '),
            meta: l.status || undefined,
            href: `/admin/deals/${l.id}`,
          });
          count++;
        }
      }
    }

    // 3. CapTarget Deals
    if (captargetDeals) {
      let count = 0;
      for (const d of captargetDeals) {
        if (count >= MAX_RESULTS_PER_CATEGORY) break;
        if (
          matchesQuery(
            q,
            d.title,
            d.internal_company_name,
            d.captarget_client_name,
            d.main_contact_name,
            d.main_contact_email,
            d.website
          )
        ) {
          all.push({
            id: d.id,
            category: 'captarget',
            title: d.internal_company_name || d.title || 'Untitled',
            subtitle: [d.main_contact_name, d.main_contact_email].filter(Boolean).join(' · '),
            meta: d.website || undefined,
            href: `/admin/remarketing/leads/captarget`,
          });
          count++;
        }
      }
    }

    // 4. GP Partner Deals
    if (gpPartnerDeals) {
      let count = 0;
      for (const d of gpPartnerDeals) {
        if (count >= MAX_RESULTS_PER_CATEGORY) break;
        if (
          matchesQuery(
            q,
            d.title,
            d.internal_company_name,
            d.main_contact_name,
            d.main_contact_email,
            d.website
          )
        ) {
          all.push({
            id: d.id,
            category: 'gp_partner',
            title: d.internal_company_name || d.title || 'Untitled',
            subtitle: [d.main_contact_name, d.main_contact_email].filter(Boolean).join(' · '),
            meta: d.website || undefined,
            href: `/admin/remarketing/leads/gp-partners`,
          });
          count++;
        }
      }
    }

    // 5. Valuation Leads
    if (valuationLeads) {
      let count = 0;
      for (const l of valuationLeads) {
        if (count >= MAX_RESULTS_PER_CATEGORY) break;
        const name = l.display_name || l.business_name || l.full_name;
        if (
          matchesQuery(q, name, l.email, l.website, l.industry, l.location, l.full_name, l.business_name)
        ) {
          all.push({
            id: l.id,
            category: 'valuation_lead',
            title: name || 'Unnamed Lead',
            subtitle: [l.industry, l.location].filter(Boolean).join(' · '),
            meta: l.email || l.website || undefined,
            href: l.pushed_listing_id
              ? `/admin/deals/${l.pushed_listing_id}`
              : `/admin/remarketing/leads/valuation`,
          });
          count++;
        }
      }
    }

    // 6. Inbound Leads
    if (inboundLeads) {
      let count = 0;
      for (const l of inboundLeads) {
        if (count >= MAX_RESULTS_PER_CATEGORY) break;
        if (matchesQuery(q, l.name, l.email, l.company_name, l.role, l.message)) {
          all.push({
            id: l.id,
            category: 'inbound_lead',
            title: l.name || l.email || 'Unnamed',
            subtitle: [l.company_name, l.role].filter(Boolean).join(' · '),
            meta: l.source || undefined,
            href: `/admin/marketplace/requests`,
          });
          count++;
        }
      }
    }

    // 7. Owner/Seller Leads
    if (ownerLeads) {
      let count = 0;
      for (const l of ownerLeads) {
        if (count >= MAX_RESULTS_PER_CATEGORY) break;
        if (matchesQuery(q, l.name, l.email, l.company_name, l.business_website)) {
          all.push({
            id: l.id,
            category: 'owner_lead',
            title: l.name || l.email || 'Unnamed',
            subtitle: l.company_name || undefined,
            meta: l.email || undefined,
            href: `/admin/settings/owner-leads`,
          });
          count++;
        }
      }
    }

    // 8. Referral Partners
    if (referralPartners) {
      let count = 0;
      for (const p of referralPartners) {
        if (count >= MAX_RESULTS_PER_CATEGORY) break;
        if (matchesQuery(q, p.name, p.company, p.email, p.phone)) {
          all.push({
            id: p.id,
            category: 'referral_partner',
            title: p.name || 'Unnamed Partner',
            subtitle: p.company || undefined,
            meta: p.email || undefined,
            href: `/admin/remarketing/leads/referrals`,
          });
          count++;
        }
      }
    }

    // 9. Buyers
    if (buyers) {
      let count = 0;
      for (const b of buyers) {
        if (count >= MAX_RESULTS_PER_CATEGORY) break;
        const fullName = [b.first_name, b.last_name].filter(Boolean).join(' ');
        if (matchesQuery(q, fullName, b.email, b.company, b.buyer_type)) {
          all.push({
            id: b.id,
            category: 'buyer',
            title: fullName || b.email || 'Unknown Buyer',
            subtitle: b.company || undefined,
            meta: b.buyer_type || undefined,
            href: `/admin/buyers`,
          });
          count++;
        }
      }
    }

    return all;
  }, [
    debouncedQuery,
    deals,
    listings,
    captargetDeals,
    gpPartnerDeals,
    valuationLeads,
    inboundLeads,
    ownerLeads,
    referralPartners,
    buyers,
  ]);

  // Group by category
  const groupedResults = useMemo(() => {
    const groups = new Map<SearchResultCategory, SearchResult[]>();
    for (const r of results) {
      if (!groups.has(r.category)) groups.set(r.category, []);
      groups.get(r.category)!.push(r);
    }
    return groups;
  }, [results]);

  const totalCount = results.length;

  const reset = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    query,
    setQuery,
    results,
    groupedResults,
    totalCount,
    isLoading,
    reset,
  };
}
