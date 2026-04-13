import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { AsyncComboboxOption } from '@/components/ui/async-combobox';

interface ListingSearchRow {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  industry: string | null;
  address_state: string | null;
}

/**
 * Debounced server-side search against the `listings` table for use in
 * AsyncCombobox. Matches against both internal_company_name and title,
 * case-insensitive substring.
 *
 * Only returns non-deleted, non-not_a_fit listings — the same filter
 * the process-portal-recommendations edge function uses.
 */
export function useListingSearch(query: string, limit = 20) {
  const debounced = useDebouncedValue(query, 250);

  const q = useQuery({
    queryKey: ['listing-search', debounced, limit],
    queryFn: async (): Promise<ListingSearchRow[]> => {
      let builder = supabase
        .from('listings')
        .select('id, title, internal_company_name, industry, address_state')
        .is('deleted_at', null)
        .or('not_a_fit.is.null,not_a_fit.eq.false')
        .order('updated_at', { ascending: false })
        .limit(limit);

      const trimmed = debounced.trim();
      if (trimmed.length > 0) {
        // .or() with ilike on two columns: match on internal company name OR title.
        // Escape any commas / parens in the query since .or() uses those as separators.
        const safe = trimmed.replace(/[(),*]/g, ' ');
        builder = builder.or(`internal_company_name.ilike.%${safe}%,title.ilike.%${safe}%`);
      }

      const { data, error } = await builder;
      if (error) throw error;
      return (data ?? []) as ListingSearchRow[];
    },
    staleTime: 30_000,
  });

  const options: AsyncComboboxOption[] = (q.data ?? []).map((row) => ({
    value: row.id,
    label: row.internal_company_name || row.title || '(Untitled)',
    description: [row.industry, row.address_state].filter(Boolean).join(' • '),
  }));

  return {
    options,
    isLoading: q.isLoading || q.isFetching,
    rows: q.data ?? [],
  };
}

/** Fetch a single listing label for AsyncCombobox's selectedLabel prop. */
export function useListingLabel(listingId: string | null | undefined) {
  return useQuery({
    queryKey: ['listing-label', listingId],
    queryFn: async () => {
      if (!listingId) return null;
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, internal_company_name')
        .eq('id', listingId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return data.internal_company_name || data.title || null;
    },
    enabled: !!listingId,
    staleTime: 5 * 60_000,
  });
}
