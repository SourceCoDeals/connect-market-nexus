/**
 * useBuyerMetrics.ts
 *
 * Data hook for the Buyer Intelligence tab. Queries remarketing_buyers, the
 * `contacts` table (filtered by remarketing_buyer_id — the old
 * remarketing_buyer_contacts table has been deprecated), and firm_agreements.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BuyerRow {
  id: string;
  buyer_type: string | null;
  archived: boolean;
  created_at: string;
}

interface ContactCountRow {
  remarketing_buyer_id: string | null;
}

interface FirmAgreementRow {
  id: string;
  fee_agreement_signed: boolean;
  nda_signed: boolean;
}

export interface BuyerTypeDist {
  type: string;
  label: string;
  count: number;
}

export interface ContactHistogramBucket {
  label: string; // '1', '2', '3', '4', '5+'
  count: number;
}

export interface BuyerKPIs {
  totalActive: number;
  byType: BuyerTypeDist[];
  avgContactsPerBuyer: number;
  buyersWithFeeAgreement: number;
  feeAgreementPct: number; // 0-100
  buyersWithMultipleContacts: number; // >=3 contacts
}

// Production buyer_type values (verified against live DB 2026-04-14). The spec
// referenced pe_firm/platform/strategic/other which aren't in production —
// the real values are below. NULL buyer_types render as "Unspecified".
const BUYER_TYPE_LABELS: Record<string, string> = {
  private_equity: 'Private Equity',
  family_office: 'Family Office',
  corporate: 'Corporate / Strategic',
  independent_sponsor: 'Independent Sponsor',
  individual_buyer: 'Individual Buyer',
  search_fund: 'Search Fund',
  // Back-compat for any row still using the old enum values:
  pe_firm: 'Private Equity',
  platform: 'Platform',
  strategic: 'Corporate / Strategic',
  other: 'Other',
};

export function useBuyerMetrics() {
  const { data: buyers, isLoading: buyersLoading } = useQuery({
    queryKey: ['buyers', 'all-active'],
    queryFn: async (): Promise<BuyerRow[]> => {
      const { data, error } = await (supabase as any)
        .from('remarketing_buyers')
        .select('id, buyer_type, archived, created_at')
        .eq('archived', false);
      if (error) throw error;
      return (data || []) as BuyerRow[];
    },
    staleTime: 2 * 60_000,
  });

  const { data: contactRows, isLoading: contactsLoading } = useQuery({
    queryKey: ['buyers', 'contact-counts'],
    queryFn: async (): Promise<ContactCountRow[]> => {
      // contacts table is the canonical source; remarketing_buyer_id is set
      // for rows that belong to a remarketing buyer firm.
      const { data, error } = await (supabase as any)
        .from('contacts')
        .select('remarketing_buyer_id')
        .not('remarketing_buyer_id', 'is', null);
      if (error) throw error;
      return (data || []) as ContactCountRow[];
    },
    staleTime: 2 * 60_000,
  });

  const { data: firmAgreements } = useQuery({
    queryKey: ['buyers', 'firm-agreements'],
    queryFn: async (): Promise<FirmAgreementRow[]> => {
      const { data, error } = await (supabase as any)
        .from('firm_agreements')
        .select('id, fee_agreement_signed, nda_signed');
      if (error) throw error;
      return (data || []) as FirmAgreementRow[];
    },
    staleTime: 2 * 60_000,
  });

  const totalActive = (buyers || []).length;

  // Buyer type distribution. Null buyer_type is grouped under "Unspecified"
  // rather than the ambiguous "Other" so gaps are visible.
  const typeMap = new Map<string, number>();
  for (const b of buyers || []) {
    const t = b.buyer_type || '__unspecified';
    typeMap.set(t, (typeMap.get(t) || 0) + 1);
  }
  const byType: BuyerTypeDist[] = Array.from(typeMap.entries())
    .map(([type, count]) => ({
      type,
      label:
        type === '__unspecified'
          ? 'Unspecified'
          : BUYER_TYPE_LABELS[type] ||
            // Humanize unknown values so users don't see raw snake_case.
            type
              .split('_')
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' '),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Contacts per buyer
  const contactsByBuyer = new Map<string, number>();
  for (const c of contactRows || []) {
    if (!c.remarketing_buyer_id) continue;
    contactsByBuyer.set(
      c.remarketing_buyer_id,
      (contactsByBuyer.get(c.remarketing_buyer_id) || 0) + 1,
    );
  }
  const avgContactsPerBuyer =
    totalActive > 0 ? Math.round(((contactRows?.length || 0) / totalActive) * 10) / 10 : 0;

  // Contacts histogram: 0, 1, 2, 3, 4, 5+ — the 0-bucket makes the coverage
  // gap visible in the chart (matches the "No Contacts" KPI).
  const histBuckets = [0, 0, 0, 0, 0, 0];
  for (const b of buyers || []) {
    const count = contactsByBuyer.get(b.id) || 0;
    const idx = count === 0 ? 0 : count >= 5 ? 5 : count;
    histBuckets[idx]++;
  }
  const contactsHistogram: ContactHistogramBucket[] = [
    { label: '0', count: histBuckets[0] },
    { label: '1', count: histBuckets[1] },
    { label: '2', count: histBuckets[2] },
    { label: '3', count: histBuckets[3] },
    { label: '4', count: histBuckets[4] },
    { label: '5+', count: histBuckets[5] },
  ];

  const buyersWithMultipleContacts = Array.from(contactsByBuyer.values()).filter(
    (c) => c >= 3,
  ).length;

  // Fee agreements (counted against firm_agreements — the canonical fee agreement table)
  const buyersWithFeeAgreement = (firmAgreements || []).filter(
    (f) => f.fee_agreement_signed,
  ).length;
  const feeAgreementPct =
    totalActive > 0 ? Math.round((buyersWithFeeAgreement / totalActive) * 1000) / 10 : 0;

  // Buyers with no contacts (coverage gap)
  const buyersWithNoContacts = (buyers || []).filter((b) => !contactsByBuyer.has(b.id)).length;

  // Growth: buyers per week for last 12 weeks, UTC bucketed.
  const growthBuckets = new Map<string, number>();
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setUTCDate(twelveWeeksAgo.getUTCDate() - 84);
  for (const b of buyers || []) {
    const d = new Date(b.created_at);
    if (d < twelveWeeksAgo) continue;
    const utcDay = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - utcDay);
    d.setUTCHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    growthBuckets.set(key, (growthBuckets.get(key) || 0) + 1);
  }
  const growthSeries = Array.from(growthBuckets.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const kpis: BuyerKPIs = {
    totalActive,
    byType,
    avgContactsPerBuyer,
    buyersWithFeeAgreement,
    feeAgreementPct,
    buyersWithMultipleContacts,
  };

  return {
    loading: buyersLoading || contactsLoading,
    kpis,
    contactsHistogram,
    growthSeries,
    buyersWithNoContacts,
  };
}
