/**
 * useContactHistory.ts
 *
 * Data fetching logic for ContactHistoryTracker: queries for associated buyers,
 * seller contacts, and combined outreach history. Also includes date-range
 * filtering and overview stats computation.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';
import {
  useContactCombinedHistory,
  useContactCombinedHistoryByEmail,
  type UnifiedActivityEntry,
} from '@/hooks/use-contact-combined-history';
import { computeActivityStats } from '@/hooks/use-activity-stats';
export type { ActivityStats as OverviewStats } from '@/hooks/use-activity-stats';

// ── Types ──

export type DateRangeValue = '7d' | '30d' | '90d' | 'all';

export interface AssociatedBuyer {
  id: string;
  buyerName: string;
  contactName: string | null;
  contactEmail: string | null;
  remarketing_buyer_id: string | null;
  buyerType: string | null;
}

export interface ContactTab {
  id: string;
  label: string;
  email?: string | null;
  buyerId?: string | null;
  type: 'primary' | 'buyer' | 'seller';
}

// ── Helpers ──

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function getDateRangeCutoff(range: DateRangeValue): Date | null {
  switch (range) {
    case '7d':
      return subDays(new Date(), 7);
    case '30d':
      return subDays(new Date(), 30);
    case '90d':
      return subDays(new Date(), 90);
    case 'all':
    default:
      return null;
  }
}

export function filterByDateRange(
  entries: UnifiedActivityEntry[],
  range: DateRangeValue,
): UnifiedActivityEntry[] {
  const cutoff = getDateRangeCutoff(range);
  if (!cutoff) return entries;
  return entries.filter((e) => new Date(e.timestamp) >= cutoff);
}

/** Compute overview stats from activity entries — delegates to shared impl */
export const computeOverview = computeActivityStats;

// ── Main hook ──

export function useContactHistory(
  listingId: string,
  primaryContactEmail: string | null | undefined,
  dateRange: DateRangeValue,
  primaryContactName?: string | null,
) {
  // Fetch associated buyers for this deal
  const { data: associatedBuyers = [], isLoading: buyersLoading } = useQuery({
    queryKey: ['contact-history-tracker-buyers', listingId],
    queryFn: async () => {
      const { data, error } = (await supabase
        .from('deal_pipeline')
        .select(
          `
          id,
          contact_name,
          contact_email,
          contact_phone,
          remarketing_buyer_id,
          buyers!deals_remarketing_buyer_id_fkey ( company_name, buyer_type )
        `,
        )
        .eq('listing_id', listingId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })) as {
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      };

      if (error) throw error;

      return (data || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        buyerName:
          ((d.buyers as Record<string, unknown> | null)?.company_name as string) ||
          (d.contact_name as string) ||
          'Unknown',
        contactName: d.contact_name as string | null,
        contactEmail: d.contact_email as string | null,
        remarketing_buyer_id: d.remarketing_buyer_id as string | null,
        buyerType: ((d.buyers as Record<string, unknown> | null)?.buyer_type as string) || null,
      }));
    },
    enabled: !!listingId,
  });

  // Fetch seller-side contacts
  const { data: sellerContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['contact-history-tracker-seller', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, title, contact_type')
        .eq('listing_id', listingId)
        .eq('archived', false)
        .order('is_primary_seller_contact', { ascending: false });

      if (error) throw error;

      return (data || []).map((c) => ({
        id: c.id as string,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
        email: c.email as string | null,
        phone: c.phone as string | null,
        title: c.title as string | null,
        contactType: c.contact_type as string | null,
      }));
    },
    enabled: !!listingId,
  });

  // Find the best buyer ID or email for the overview
  const primaryBuyerId =
    associatedBuyers.find((b) => b.remarketing_buyer_id)?.remarketing_buyer_id || null;
  const lookupEmail =
    primaryContactEmail || associatedBuyers.find((b) => b.contactEmail)?.contactEmail || null;

  // Fetch combined history for overview stats
  const { data: entriesByBuyer = [], isLoading: historyByBuyerLoading } =
    useContactCombinedHistory(primaryBuyerId);
  const { data: entriesByEmail = [], isLoading: historyByEmailLoading } =
    useContactCombinedHistoryByEmail(!primaryBuyerId ? lookupEmail : null);

  const isLoading =
    buyersLoading || contactsLoading || historyByBuyerLoading || historyByEmailLoading;
  const allEntries = primaryBuyerId ? entriesByBuyer : entriesByEmail;

  // Filter by date range
  const filteredEntries = useMemo(
    () => filterByDateRange(allEntries, dateRange),
    [allEntries, dateRange],
  );

  // Compute overview from filtered entries
  const overview = useMemo(() => computeOverview(filteredEntries), [filteredEntries]);

  // Build contact tabs for the per-contact activity log section
  const contactTabs = useMemo(() => {
    const allContactEmails = new Set<string>();
    if (primaryContactEmail) allContactEmails.add(primaryContactEmail.toLowerCase());

    const uniqueBuyers: AssociatedBuyer[] = [];
    for (const b of associatedBuyers) {
      const email = b.contactEmail?.toLowerCase();
      if (email && allContactEmails.has(email)) continue;
      if (email) allContactEmails.add(email);
      uniqueBuyers.push(b);
    }

    const tabs: ContactTab[] = [];

    if (primaryContactEmail) {
      tabs.push({
        id: 'primary',
        label: primaryContactName || 'Primary Contact',
        email: primaryContactEmail,
        type: 'primary',
      });
    }

    for (const b of uniqueBuyers) {
      tabs.push({
        id: `buyer-${b.id}`,
        label: b.contactName || b.buyerName,
        email: b.contactEmail,
        buyerId: b.remarketing_buyer_id,
        type: 'buyer',
      });
    }

    for (const c of sellerContacts) {
      if (allContactEmails.has(c.email?.toLowerCase() || '')) continue;
      tabs.push({
        id: `seller-${c.id}`,
        label: c.name,
        email: c.email,
        type: 'seller',
      });
    }

    return tabs;
  }, [primaryContactEmail, primaryContactName, associatedBuyers, sellerContacts]);

  return {
    isLoading,
    filteredEntries,
    overview,
    contactTabs,
  };
}
