/**
 * process-portal-recommendations
 *
 * Runs on cron every 5 minutes (see 20260703000001_portal_intelligence_audit_fixes.sql).
 * Evaluates queued listings against all active portal thesis criteria and
 * creates/updates recommendations.
 *
 * Authentication: service-role only. Call via the cron job header.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { requireServiceRole } from '../_shared/auth.ts';
import {
  planRecommendationWrites,
  type ExistingRecommendation,
  type ThesisCriteria,
} from './scoring.ts';

const BATCH_SIZE = 200;

serve(async (req) => {
  // P1-7: Require service-role authentication (cron-only function).
  const authCheck = requireServiceRole(req);
  if (!authCheck.authorized) {
    return new Response(JSON.stringify({ error: authCheck.error ?? 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const results = { processed: 0, created: 0, updated: 0, reaped: 0, errors: 0 };

  try {
    // 1. Pull queued listing IDs with their queued_at timestamps so we can
    // safely delete only the rows we actually processed (P0-3).
    const { data: queue } = await supabase
      .from('portal_recommendation_queue')
      .select('listing_id, queued_at')
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (!queue || queue.length === 0) {
      return new Response(JSON.stringify({ ...results, message: 'Queue empty' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const listingIds = queue.map((q) => q.listing_id);
    // Use the max queued_at of the batch as the high-water mark. Anything
    // re-enqueued after this (by a trigger firing mid-run) will have a
    // queued_at > maxQueuedAt and will NOT be deleted at the end (P0-3).
    const maxQueuedAt = queue.map((q) => q.queued_at as string).reduce((a, b) => (a > b ? a : b));

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
        'id, portal_org_id, industry_label, industry_keywords, excluded_keywords, ebitda_min, ebitda_max, revenue_min, revenue_max, employee_min, employee_max, target_states, portfolio_buyer_id, priority',
      )
      .eq('is_active', true);

    let activeCriteria: ThesisCriteria[] = [];

    if (allCriteria && allCriteria.length > 0) {
      const orgIds = [...new Set(allCriteria.map((c) => c.portal_org_id))];
      const { data: activeOrgs } = await supabase
        .from('portal_organizations')
        .select('id')
        .in('id', orgIds)
        .eq('status', 'active');

      const activeOrgIds = new Set((activeOrgs ?? []).map((o) => o.id));
      activeCriteria = allCriteria.filter((c) =>
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
    }

    // 4. Batch-fetch all existing recommendations for these listings (P2-15).
    // This avoids N+1 SELECTs inside the inner loop.
    let existingRecs: ExistingRecommendation[] = [];
    if (validListings.length > 0) {
      const { data: existingRows } = await supabase
        .from('portal_deal_recommendations')
        .select('id, portal_org_id, listing_id, match_score, match_reasons, status')
        .in(
          'listing_id',
          validListings.map((l) => l.id),
        );
      existingRecs = (existingRows ?? []) as ExistingRecommendation[];
    }

    // 5. Compute inserts/updates/reaps via the pure planner (testable).
    results.processed += validListings.length;
    const { toInsert, toUpdate, toReap } = planRecommendationWrites(
      validListings as unknown as Parameters<typeof planRecommendationWrites>[0],
      activeCriteria,
      existingRecs,
    );

    // 7. Execute writes. Abort the queue-drain if any write errors (P0-4).
    let writeFailure = false;

    if (toInsert.length > 0) {
      const { error, count } = await supabase
        .from('portal_deal_recommendations')
        .insert(toInsert, { count: 'exact' });
      if (error) {
        console.error('Portal recommendation insert error:', error.message);
        results.errors++;
        writeFailure = true;
      } else {
        results.created += count ?? toInsert.length;
      }
    }

    for (const { id, patch } of toUpdate) {
      const { error } = await supabase
        .from('portal_deal_recommendations')
        .update(patch)
        .eq('id', id);
      if (error) {
        console.error('Portal recommendation update error:', error.message, id);
        results.errors++;
        writeFailure = true;
      } else {
        results.updated++;
      }
    }

    if (toReap.length > 0) {
      const { error, count } = await supabase
        .from('portal_deal_recommendations')
        .update({ status: 'stale' })
        .in('id', toReap);
      if (error) {
        console.error('Portal recommendation reap error:', error.message);
        results.errors++;
        writeFailure = true;
      } else {
        results.reaped += count ?? toReap.length;
      }
    }

    // 8. Clear processed queue items — but ONLY rows queued at or before
    // maxQueuedAt (P0-3), and ONLY if all writes succeeded (P0-4).
    // Rows re-enqueued by a trigger mid-run will have queued_at > maxQueuedAt
    // and will survive, getting picked up on the next cron tick.
    if (!writeFailure) {
      await supabase
        .from('portal_recommendation_queue')
        .delete()
        .in('listing_id', listingIds)
        .lte('queued_at', maxQueuedAt);
    }
  } catch (err) {
    console.error('Portal recommendation processing error:', err);
    results.errors++;
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
});
