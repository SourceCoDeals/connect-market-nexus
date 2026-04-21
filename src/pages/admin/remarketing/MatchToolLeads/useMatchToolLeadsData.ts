/**
 * Barrel composing query + mutation hooks for MatchToolLeads.
 * Mirrors useValuationLeadsData — queries are re-subscribed with the active
 * contact-polling window so live updates flow in while async lookups run.
 */

import { useMatchToolLeadsQueries, PAGE_SIZE } from './useMatchToolLeadsQueries';
import { useMatchToolLeadsMutations } from './useMatchToolLeadsMutations';

export { PAGE_SIZE };
export { useMatchToolLeadsMutations };

export function useMatchToolLeadsData() {
  const queries = useMatchToolLeadsQueries();

  const mutations = useMatchToolLeadsMutations({
    leads: queries.leads,
    filteredLeads: queries.filteredLeads,
    selectedIds: queries.selectedIds,
    setSelectedIds: queries.setSelectedIds,
    setHideNotFit: queries.setHideNotFit,
  });

  // Re-subscribe with the active polling window. React-query dedupes the
  // underlying fetch — only effect is enabling `refetchInterval`.
  useMatchToolLeadsQueries({ contactPollingUntil: mutations.contactPollingUntil });

  return {
    ...queries,
    ...mutations,
  };
}
