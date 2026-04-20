import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { AsyncComboboxOption } from '@/components/ui/async-combobox';

interface BuyerSearchRow {
  id: string;
  company_name: string | null;
  buyer_type: string | null;
  hq_city: string | null;
  hq_state: string | null;
}

/**
 * Debounced server-side search against the `buyers` table, suitable for
 * feeding an AsyncCombobox. Returns options formatted for display plus
 * the raw rows (in case a caller needs more data from the selection).
 *
 * Usage:
 *   const [query, setQuery] = useState('');
 *   const { options, isLoading } = useBuyerSearch(query);
 *   <AsyncCombobox
 *     options={options}
 *     onSearchChange={setQuery}
 *     isLoading={isLoading}
 *     value={...}
 *     onValueChange={...}
 *   />
 */
export function useBuyerSearch(query: string, limit = 20) {
  const debounced = useDebouncedValue(query, 250);

  const q = useQuery({
    queryKey: ['buyer-search', debounced, limit],
    queryFn: async (): Promise<BuyerSearchRow[]> => {
      let builder = (supabase.from('buyers') as any)
        .select('id, company_name, buyer_type, hq_city, hq_state')
        .order('company_name', { ascending: true })
        .limit(limit);

      if (debounced.trim().length > 0) {
        builder = builder.ilike('company_name', `%${debounced.trim()}%`);
      }

      const { data, error } = await builder;
      if (error) throw error;
      return (data ?? []) as BuyerSearchRow[];
    },
    staleTime: 30_000,
  });

  const options: AsyncComboboxOption[] = (q.data ?? []).map((row) => ({
    value: row.id,
    label: row.company_name ?? '(Unnamed)',
    description: [
      row.buyer_type?.replace(/_/g, ' '),
      [row.hq_city, row.hq_state].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(' • '),
  }));

  return {
    options,
    isLoading: q.isLoading || q.isFetching,
    rows: q.data ?? [],
  };
}

/**
 * Fetch a single buyer by id. Used to render the "selected" label in
 * an AsyncCombobox when the current value isn't in the live search
 * results.
 */
export function useBuyerLabel(buyerId: string | null | undefined) {
  return useQuery({
    queryKey: ['buyer-label', buyerId],
    queryFn: async () => {
      if (!buyerId) return null;
      const { data, error } = await supabase
        .from('buyers')
        .select('id, company_name')
        .eq('id', buyerId)
        .maybeSingle();
      if (error) throw error;
      return data?.company_name ?? null;
    },
    enabled: !!buyerId,
    staleTime: 5 * 60_000,
  });
}
