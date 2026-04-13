/**
 * process-portal-recommendations
 *
 * Runs on cron every 5 minutes. Evaluates queued listings against all active
 * portal thesis criteria and creates/updates recommendations.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BATCH_SIZE = 200;

interface ThesisCriteria {
  id: string;
  portal_org_id: string;
  industry_label: string;
  industry_keywords: string[];
  ebitda_min: number | null;
  ebitda_max: number | null;
  revenue_min: number | null;
  revenue_max: number | null;
  employee_min: number | null;
  employee_max: number | null;
  target_states: string[];
  portfolio_buyer_id: string | null;
  portfolio_company_name?: string;
  priority: number;
}

function scoreListingAgainstCriteria(
  listing: Record<string, unknown>,
  criteria: ThesisCriteria,
): { score: number; reasons: string[]; category: string } {
  const reasons: string[] = [];
  let score = 0;

  // ── INDUSTRY MATCH (0-40, hard gate) ──
  const listingText = [
    listing.industry,
    listing.category,
    ...(Array.isArray(listing.categories) ? listing.categories : []),
    ...(Array.isArray(listing.services) ? listing.services : []),
    listing.service_mix,
    listing.executive_summary,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const industryMatch = criteria.industry_keywords.some((kw) =>
    listingText.includes(kw.toLowerCase()),
  );

  if (!industryMatch) {
    return { score: 0, reasons: [], category: 'weak' };
  }

  score += 40;
  reasons.push(`${criteria.industry_label} match`);

  // ── GEOGRAPHY MATCH (0-25) ──
  const targetStates = criteria.target_states || [];
  const listingState = String(listing.address_state || '')
    .toUpperCase()
    .trim();

  if (targetStates.length === 0) {
    score += 25;
    reasons.push('National geography');
  } else if (listingState && targetStates.some((s) => s.toUpperCase() === listingState)) {
    score += 25;
    reasons.push(`${listingState} geography match`);
  } else if (listingState) {
    score += 5;
    reasons.push(`${listingState} outside target states`);
  }

  // ── SIZE MATCH (0-25) ──
  const ebitda = Number(listing.ebitda) || 0;
  const revenue = Number(listing.revenue) || 0;

  if (ebitda > 0 && (criteria.ebitda_min || criteria.ebitda_max)) {
    const inRange =
      (!criteria.ebitda_min || ebitda >= criteria.ebitda_min) &&
      (!criteria.ebitda_max || ebitda <= criteria.ebitda_max);
    if (inRange) {
      score += 25;
      reasons.push(`EBITDA $${(ebitda / 1_000_000).toFixed(1)}M in range`);
    } else {
      score += 5;
      reasons.push(`EBITDA $${(ebitda / 1_000_000).toFixed(1)}M outside range`);
    }
  } else if (revenue > 0 && (criteria.revenue_min || criteria.revenue_max)) {
    const inRange =
      (!criteria.revenue_min || revenue >= criteria.revenue_min) &&
      (!criteria.revenue_max || revenue <= criteria.revenue_max);
    if (inRange) {
      score += 20;
      reasons.push(`Revenue $${(revenue / 1_000_000).toFixed(1)}M in range`);
    } else {
      score += 5;
      reasons.push(`Revenue outside range`);
    }
  } else {
    const emp = Number(listing.linkedin_employee_count) || 0;
    if (emp > 0 && (criteria.employee_min || criteria.employee_max)) {
      const inRange =
        (!criteria.employee_min || emp >= criteria.employee_min) &&
        (!criteria.employee_max || emp <= criteria.employee_max);
      if (inRange) {
        score += 15;
        reasons.push(`${emp} employees (proxy, in range)`);
      } else {
        score += 3;
        reasons.push(`${emp} employees (proxy, outside range)`);
      }
    }
  }

  // ── QUALITY BONUS (0-10) ──
  const dealScore = Number(listing.deal_total_score) || 0;
  if (dealScore >= 60) {
    score += 10;
    reasons.push('High quality score');
  } else if (dealScore >= 40) {
    score += 5;
    reasons.push('Moderate quality score');
  }

  const category = score >= 70 ? 'strong' : score >= 45 ? 'moderate' : 'weak';
  return { score, reasons, category };
}

serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const results = { processed: 0, created: 0, updated: 0 };

  try {
    // 1. Pull queued listing IDs
    const { data: queue } = await supabase
      .from('portal_recommendation_queue')
      .select('listing_id')
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (!queue || queue.length === 0) {
      return new Response(JSON.stringify({ ...results, message: 'Queue empty' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const listingIds = queue.map((q) => q.listing_id);

    // 2. Fetch listings
    const { data: listings } = await supabase
      .from('listings')
      .select(
        'id, industry, category, categories, services, service_mix, executive_summary, address_state, ebitda, revenue, linkedin_employee_count, number_of_locations, deal_total_score, internal_company_name, title, deleted_at, not_a_fit',
      )
      .in('id', listingIds);

    const validListings = (listings ?? []).filter(
      (l) => l.deleted_at == null && (l.not_a_fit === false || l.not_a_fit == null),
    );

    // 3. Fetch all active thesis criteria from active portals
    const { data: allCriteria } = await supabase
      .from('portal_thesis_criteria')
      .select(
        'id, portal_org_id, industry_label, industry_keywords, ebitda_min, ebitda_max, revenue_min, revenue_max, employee_min, employee_max, target_states, portfolio_buyer_id, priority',
      )
      .eq('is_active', true);

    // Filter to only active portal orgs
    if (allCriteria && allCriteria.length > 0) {
      const orgIds = [...new Set(allCriteria.map((c) => c.portal_org_id))];
      const { data: activeOrgs } = await supabase
        .from('portal_organizations')
        .select('id')
        .in('id', orgIds)
        .eq('status', 'active');

      const activeOrgIds = new Set((activeOrgs ?? []).map((o) => o.id));
      const activeCriteria = allCriteria.filter((c) =>
        activeOrgIds.has(c.portal_org_id),
      ) as ThesisCriteria[];

      // Fetch portfolio company names for display
      const portfolioIds = [
        ...new Set(activeCriteria.map((c) => c.portfolio_buyer_id).filter(Boolean)),
      ] as string[];
      const portfolioMap = new Map<string, string>();
      if (portfolioIds.length > 0) {
        const { data: buyers } = await supabase
          .from('buyers')
          .select('id, company_name')
          .in('id', portfolioIds);
        for (const b of buyers ?? []) portfolioMap.set(b.id, b.company_name || '');
      }

      for (const c of activeCriteria) {
        if (c.portfolio_buyer_id) {
          c.portfolio_company_name = portfolioMap.get(c.portfolio_buyer_id) || undefined;
        }
      }

      // 4. Evaluate each listing against each criterion
      for (const listing of validListings) {
        results.processed++;

        // Group criteria by portal_org_id — only keep best match per org
        const bestByOrg = new Map<
          string,
          {
            criteria: ThesisCriteria;
            score: number;
            reasons: string[];
            category: string;
          }
        >();

        for (const criteria of activeCriteria) {
          const result = scoreListingAgainstCriteria(listing as Record<string, unknown>, criteria);

          if (result.score < 30) continue; // Below threshold

          const existing = bestByOrg.get(criteria.portal_org_id);
          if (!existing || result.score > existing.score) {
            bestByOrg.set(criteria.portal_org_id, {
              criteria,
              ...result,
            });
          }
        }

        // 5. Upsert recommendations
        for (const [orgId, match] of bestByOrg) {
          const { data: existing } = await supabase
            .from('portal_deal_recommendations')
            .select('id, match_score, status')
            .eq('portal_org_id', orgId)
            .eq('listing_id', listing.id)
            .maybeSingle();

          if (!existing) {
            const { error } = await supabase.from('portal_deal_recommendations').insert({
              portal_org_id: orgId,
              listing_id: listing.id,
              thesis_criteria_id: match.criteria.id,
              portfolio_buyer_id: match.criteria.portfolio_buyer_id,
              portfolio_company_name: match.criteria.portfolio_company_name || null,
              match_score: match.score,
              match_reasons: match.reasons,
              match_category: match.category,
              status: 'pending',
            });
            if (!error) results.created++;
          } else if (existing.status === 'pending' && existing.match_score !== match.score) {
            // Update score if it changed (only for pending — don't touch reviewed ones)
            await supabase
              .from('portal_deal_recommendations')
              .update({
                match_score: match.score,
                match_reasons: match.reasons,
                match_category: match.category,
                thesis_criteria_id: match.criteria.id,
                portfolio_buyer_id: match.criteria.portfolio_buyer_id,
                portfolio_company_name: match.criteria.portfolio_company_name || null,
              })
              .eq('id', existing.id);
            results.updated++;
          }
        }
      }
    }

    // 6. Clear processed queue items
    await supabase.from('portal_recommendation_queue').delete().in('listing_id', listingIds);
  } catch (err) {
    console.error('Portal recommendation processing error:', err);
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
});
