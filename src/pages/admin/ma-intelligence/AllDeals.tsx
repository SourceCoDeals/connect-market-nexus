import { Navigate } from "react-router-dom";

/**
 * DEPRECATED: MA Intelligence AllDeals page.
 *
 * The unified All Deals view lives at /admin/deals (ReMarketingDeals).
 * This component previously queried the `deals` table directly with
 * `supabase.from("deals").select("*")` and used incorrect field mappings
 * (the `deals` table holds pipeline entries, not deal/company data).
 *
 * The route `/admin/ma-intelligence/deals` already redirects via App.tsx,
 * but this fallback ensures anyone rendering the component directly
 * also gets redirected.
 */
export default function MAAllDeals() {
  return <Navigate to="/admin/deals" replace />;
}
