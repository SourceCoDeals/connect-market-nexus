/**
 * Barrel re-export composing query and mutation hooks for ValuationLeads.
 *
 * All original exports remain accessible from this path
 * for backwards compatibility.
 */

import { useValuationLeadsQueries, PAGE_SIZE } from './useValuationLeadsQueries';
import { useValuationLeadsMutations } from './useValuationLeadsMutations';

export { PAGE_SIZE };
export { useValuationLeadsMutations };

export function useValuationLeadsData() {
  // We need the polling-window state from mutations to feed back into queries.
  // To avoid a circular hook, we run a lightweight first pass with no polling,
  // build mutations (which expose `contactPollingUntil`), then re-run queries
  // with that value. React-query dedupes the underlying fetch, so this is cheap.
  const queries = useValuationLeadsQueries();

  const mutations = useValuationLeadsMutations({
    leads: queries.leads,
    filteredLeads: queries.filteredLeads,
    selectedIds: queries.selectedIds,
    setSelectedIds: queries.setSelectedIds,
    enrichmentSummary: queries.enrichmentSummary,
    dismissSummary: queries.dismissSummary,
    setHideNotFit: queries.setHideNotFit,
  });

  // Second-pass query subscription with the active polling window. Reuses
  // the same query key so React Query serves cached data; the only effect
  // is enabling `refetchInterval` while a Clay search is in flight.
  useValuationLeadsQueries({ contactPollingUntil: mutations.contactPollingUntil });

  return {
    ...queries,
    ...mutations,
  };
}
