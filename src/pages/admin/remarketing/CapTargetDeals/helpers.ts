import type { CapTargetDeal, SortColumn, SortDirection } from './types';

/**
 * Sort an array of CapTargetDeal by the given column and direction.
 * Returns a new sorted array (does not mutate the input).
 */
export function sortDeals(
  deals: CapTargetDeal[],
  sortColumn: SortColumn,
  sortDirection: SortDirection,
): CapTargetDeal[] {
  const sorted = [...deals];
  sorted.sort((a, b) => {
    let valA: string | number, valB: string | number;
    switch (sortColumn) {
      case 'company_name':
        valA = (a.internal_company_name || a.title || '').toLowerCase();
        valB = (b.internal_company_name || b.title || '').toLowerCase();
        break;
      case 'client_name':
        valA = (a.category || a.industry || '').toLowerCase();
        valB = (b.category || b.industry || '').toLowerCase();
        break;
      case 'contact_name':
        valA = (a.main_contact_name || '').toLowerCase();
        valB = (b.main_contact_name || '').toLowerCase();
        break;
      case 'interest_type':
        valA = a.captarget_interest_type || '';
        valB = b.captarget_interest_type || '';
        break;
      case 'outreach_channel':
        valA = a.captarget_outreach_channel || '';
        valB = b.captarget_outreach_channel || '';
        break;
      case 'contact_date':
        valA = a.captarget_contact_date || '';
        valB = b.captarget_contact_date || '';
        break;
      case 'pushed':
        valA = a.pushed_to_all_deals ? 1 : 0;
        valB = b.pushed_to_all_deals ? 1 : 0;
        break;
      case 'score':
        valA = a.deal_total_score ?? -1;
        valB = b.deal_total_score ?? -1;
        break;
      case 'linkedin_employee_count':
        valA = a.linkedin_employee_count ?? -1;
        valB = b.linkedin_employee_count ?? -1;
        break;
      case 'linkedin_employee_range':
        valA = (a.linkedin_employee_range || '').toLowerCase();
        valB = (b.linkedin_employee_range || '').toLowerCase();
        break;
      case 'google_review_count':
        valA = a.google_review_count ?? -1;
        valB = b.google_review_count ?? -1;
        break;
      case 'google_rating':
        valA = a.google_rating ?? -1;
        valB = b.google_rating ?? -1;
        break;
      case 'priority':
        valA = a.is_priority_target ? 1 : 0;
        valB = b.is_priority_target ? 1 : 0;
        break;
      default:
        return 0;
    }
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

/**
 * Pre-filter deals before the status tab is applied.
 * This excludes based on search, pushed status, hide flags, source tab,
 * and date range — but NOT the active/inactive status tab.
 */
export function preFilterDeals(
  deals: CapTargetDeal[],
  opts: {
    search: string;
    pushedFilter: string;
    hidePushed: boolean;
    hideNotFit: boolean;
    sourceTabFilter: string;
    dateRange: { from?: Date | null; to?: Date | null };
  },
): CapTargetDeal[] {
  return deals.filter((deal) => {
    if (opts.search) {
      const q = opts.search.toLowerCase();
      const matchesSearch =
        (deal.title || '').toLowerCase().includes(q) ||
        (deal.internal_company_name || '').toLowerCase().includes(q) ||
        (deal.captarget_client_name || '').toLowerCase().includes(q) ||
        (deal.main_contact_name || '').toLowerCase().includes(q) ||
        (deal.main_contact_email || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (opts.pushedFilter === 'pushed' && !deal.pushed_to_all_deals) return false;
    if (opts.pushedFilter === 'not_pushed' && deal.pushed_to_all_deals) return false;
    if (opts.hidePushed && deal.pushed_to_all_deals) return false;
    if (opts.hideNotFit && deal.remarketing_status === 'not_a_fit') return false;
    if (opts.sourceTabFilter !== 'all' && deal.captarget_sheet_tab !== opts.sourceTabFilter)
      return false;
    if (opts.dateRange.from || opts.dateRange.to) {
      const dateStr = deal.captarget_contact_date || deal.created_at;
      const dealDate = dateStr ? new Date(dateStr) : null;
      if (!dealDate) return false;
      if (opts.dateRange.from && dealDate < opts.dateRange.from) return false;
      if (opts.dateRange.to && dealDate > opts.dateRange.to) return false;
    }
    return true;
  });
}

/**
 * Check whether a deal has an invalid / placeholder website.
 */
export function hasInvalidWebsite(deal: CapTargetDeal): boolean {
  const w = (deal.website || '').trim().toLowerCase();
  return (
    !w ||
    w.endsWith('.unknown') ||
    w.startsWith('unknown-') ||
    ['n/a', 'none', 'unknown', 'na', 'null', '-'].includes(w)
  );
}
