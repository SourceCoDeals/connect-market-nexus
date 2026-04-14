import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Range of dates for filtering metrics. Both values are ISO strings. The `from`
 * is inclusive and `to` is exclusive (typical half-open interval) so consecutive
 * periods do not double-count events on the boundary.
 */
export interface MarketplaceMetricsRange {
  from: string;
  to: string;
}

/**
 * All marketplace metrics aggregated over a given date range.
 *
 * Users: bucketed by `profiles.created_at` because the profiles table does not
 * currently track an approval/rejection timestamp. "Approved in period" therefore
 * means "signed up in the period and are now approved" — i.e. a cohort view.
 *
 * Connection requests: bucketed by the relevant decision timestamp when present
 * (`approved_at`, `rejected_at`) and by `created_at` for new/pending.
 *
 * Listings ("deals"): bucketed by `listings.created_at`.
 *
 * Meetings: bucketed by `standup_meetings.meeting_date`.
 */
export interface MarketplaceMetrics {
  // Users
  newSignups: number;
  usersApproved: number;
  usersRejected: number;
  usersPending: number;

  // Deals / listings
  dealsAdded: number;
  ebitdaAdded: number;
  revenueAdded: number;
  dealsByStatus: Array<{ status: string; count: number }>;
  dealsByIndustry: Array<{ industry: string; count: number }>;

  // Connection requests
  connectionRequestsCreated: number;
  connectionRequestsApproved: number;
  connectionRequestsRejected: number;
  connectionRequestsPending: number;
  connectionRequestsPerDeal: number;

  // Meetings
  meetingsHeld: number;
  meetingMinutes: number;
}

async function fetchMarketplaceMetrics(
  range: MarketplaceMetricsRange,
): Promise<MarketplaceMetrics> {
  const { from, to } = range;

  // Run all queries in parallel for speed. Each query is scoped to the range
  // using a half-open interval [from, to).
  const [
    newSignupsRes,
    usersApprovedRes,
    usersRejectedRes,
    usersPendingRes,
    dealsAddedRes,
    dealsFinancialsRes,
    dealsByStatusRes,
    dealsByIndustryRes,
    connectionsCreatedRes,
    connectionsApprovedRes,
    connectionsRejectedRes,
    connectionsPendingRes,
    meetingsRes,
    totalListingsRes,
  ] = await Promise.all([
    // New signups in period
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', from)
      .lt('created_at', to),

    // Users approved (signed up in period, currently approved)
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'approved')
      .gte('created_at', from)
      .lt('created_at', to),

    // Users rejected (signed up in period, currently rejected)
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'rejected')
      .gte('created_at', from)
      .lt('created_at', to),

    // Users pending (signed up in period, currently pending)
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
      .gte('created_at', from)
      .lt('created_at', to),

    // Deals/listings added in period
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', from)
      .lt('created_at', to),

    // Deal financials (sum of ebitda + revenue for new deals)
    supabase
      .from('listings')
      .select('ebitda, revenue')
      .gte('created_at', from)
      .lt('created_at', to),

    // Deals by status
    supabase
      .from('listings')
      .select('status')
      .gte('created_at', from)
      .lt('created_at', to),

    // Deals by industry
    supabase
      .from('listings')
      .select('industry')
      .gte('created_at', from)
      .lt('created_at', to),

    // Connection requests created in period
    supabase
      .from('connection_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', from)
      .lt('created_at', to),

    // Connection requests approved in period (by approved_at timestamp)
    supabase
      .from('connection_requests')
      .select('id', { count: 'exact', head: true })
      .gte('approved_at', from)
      .lt('approved_at', to),

    // Connection requests rejected in period (by rejected_at timestamp)
    supabase
      .from('connection_requests')
      .select('id', { count: 'exact', head: true })
      .gte('rejected_at', from)
      .lt('rejected_at', to),

    // Connection requests still pending (snapshot — not date-filtered)
    supabase
      .from('connection_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    // Meetings held in period
    supabase
      .from('standup_meetings')
      .select('meeting_duration_minutes')
      .gte('meeting_date', from)
      .lt('meeting_date', to),

    // Total listings (for requests-per-deal denominator). We use total listings
    // rather than only new listings so the ratio reflects the whole marketplace.
    supabase.from('listings').select('id', { count: 'exact', head: true }),
  ]);

  // Sum EBITDA and revenue from new listings
  const financialsRows = (dealsFinancialsRes.data ?? []) as Array<{
    ebitda: number | null;
    revenue: number | null;
  }>;
  const ebitdaAdded = financialsRows.reduce((sum, row) => sum + (row.ebitda ?? 0), 0);
  const revenueAdded = financialsRows.reduce((sum, row) => sum + (row.revenue ?? 0), 0);

  // Bucket deals by status
  const statusRows = (dealsByStatusRes.data ?? []) as Array<{ status: string | null }>;
  const statusCounts = new Map<string, number>();
  for (const row of statusRows) {
    const key = row.status ?? 'unknown';
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
  }
  const dealsByStatus = Array.from(statusCounts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Bucket deals by industry
  const industryRows = (dealsByIndustryRes.data ?? []) as Array<{ industry: string | null }>;
  const industryCounts = new Map<string, number>();
  for (const row of industryRows) {
    const key = row.industry ?? 'Unknown';
    industryCounts.set(key, (industryCounts.get(key) ?? 0) + 1);
  }
  const dealsByIndustry = Array.from(industryCounts.entries())
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Meetings: count + total minutes
  const meetingsRows = (meetingsRes.data ?? []) as Array<{
    meeting_duration_minutes: number | null;
  }>;
  const meetingsHeld = meetingsRows.length;
  const meetingMinutes = meetingsRows.reduce(
    (sum, row) => sum + (row.meeting_duration_minutes ?? 0),
    0,
  );

  // Requests per deal (global snapshot using total listings as denominator)
  const totalListings = totalListingsRes.count ?? 0;
  const connectionRequestsCreated = connectionsCreatedRes.count ?? 0;
  const connectionRequestsPerDeal =
    totalListings > 0 ? connectionRequestsCreated / totalListings : 0;

  return {
    newSignups: newSignupsRes.count ?? 0,
    usersApproved: usersApprovedRes.count ?? 0,
    usersRejected: usersRejectedRes.count ?? 0,
    usersPending: usersPendingRes.count ?? 0,

    dealsAdded: dealsAddedRes.count ?? 0,
    ebitdaAdded,
    revenueAdded,
    dealsByStatus,
    dealsByIndustry,

    connectionRequestsCreated,
    connectionRequestsApproved: connectionsApprovedRes.count ?? 0,
    connectionRequestsRejected: connectionsRejectedRes.count ?? 0,
    connectionRequestsPending: connectionsPendingRes.count ?? 0,
    connectionRequestsPerDeal,

    meetingsHeld,
    meetingMinutes,
  };
}

/**
 * Hook that returns all marketplace KPIs for a given date range.
 *
 * Results are cached by React Query keyed on the range, so flipping between
 * presets (7d, 30d, MTD, ...) is instant after the first fetch.
 */
export function useMarketplaceMetrics(range: MarketplaceMetricsRange) {
  const { user, authChecked, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['marketplace-metrics', range.from, range.to],
    queryFn: () => fetchMarketplaceMetrics(range),
    enabled: authChecked && !!user && isAdmin,
    staleTime: 60_000,
  });
}
