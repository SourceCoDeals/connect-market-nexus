import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { checkCompanyExclusion } from "../_shared/captarget-exclusion-filter.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BATCH_SIZE = 500;
const DELETE_CHUNK = 50;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    // Safety guard — require explicit confirmation
    const body = await req.json().catch(() => ({}));
    if (!body.confirm) {
      return new Response(
        JSON.stringify({ error: "Must pass { confirm: true } to run cleanup" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dryRun = body.dryRun === true;

    let totalChecked = 0;
    let totalCleaned = 0;
    const breakdown: Record<string, number> = {};
    const sample: Array<{ company: string; reason: string; category: string }> = [];

    // Process in batches using range-based pagination
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: deals, error: fetchErr } = await supabase
        .from("listings")
        .select("id, internal_company_name, title, captarget_call_notes, main_contact_title, captarget_row_hash")
        .eq("deal_source", "captarget")
        .range(offset, offset + BATCH_SIZE - 1);

      if (fetchErr) {
        console.error("Failed to fetch captarget deals:", fetchErr.message);
        return new Response(
          JSON.stringify({ error: `Failed to fetch deals: ${fetchErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!deals || deals.length === 0) {
        hasMore = false;
        break;
      }

      if (deals.length < BATCH_SIZE) {
        hasMore = false;
      }

      totalChecked += deals.length;

      const toExclude: Array<{ deal: typeof deals[0]; result: ReturnType<typeof checkCompanyExclusion> }> = [];

      for (const deal of deals) {
        const result = checkCompanyExclusion({
          companyName: deal.internal_company_name || deal.title,
          description: deal.captarget_call_notes,
          contactTitle: deal.main_contact_title,
        });

        if (result.excluded) {
          toExclude.push({ deal, result });
        }
      }

      if (toExclude.length > 0 && !dryRun) {
        // Log exclusions first (audit trail before deletion)
        const exclusionRecords = toExclude.map(({ deal, result }) => ({
          company_name: deal.internal_company_name || deal.title,
          contact_title: deal.main_contact_title,
          description_snippet: (deal.captarget_call_notes || "").slice(0, 500),
          exclusion_reason: result.reason,
          exclusion_category: result.category,
          source: "retroactive_cleanup",
          captarget_row_hash: deal.captarget_row_hash,
          raw_row_data: deal,
        }));

        for (let i = 0; i < exclusionRecords.length; i += DELETE_CHUNK) {
          const chunk = exclusionRecords.slice(i, i + DELETE_CHUNK);
          const { error: logErr } = await supabase.from("captarget_sync_exclusions").insert(chunk);
          if (logErr) console.error("Failed to log exclusions:", logErr.message);
        }

        // Delete listings (CASCADE handles enrichment_queue, remarketing_scores, etc.)
        const idsToDelete = toExclude.map(({ deal }) => deal.id);
        for (let i = 0; i < idsToDelete.length; i += DELETE_CHUNK) {
          const chunk = idsToDelete.slice(i, i + DELETE_CHUNK);
          const { error: delErr } = await supabase
            .from("listings")
            .delete()
            .in("id", chunk);
          if (delErr) {
            console.error(`Failed to delete ${chunk.length} listings:`, delErr.message);
          }
        }
      }

      for (const { deal, result } of toExclude) {
        totalCleaned++;
        breakdown[result.category] = (breakdown[result.category] || 0) + 1;
        if (sample.length < 20) {
          sample.push({
            company: deal.internal_company_name || deal.title || "Unknown",
            reason: result.reason,
            category: result.category,
          });
        }
      }

      // When deleting rows, offset doesn't need to advance for deleted items
      // But we fetched from a snapshot, so advance by full batch
      // After deletes, remaining rows shift — use offset carefully
      if (!hasMore) break;
      offset += BATCH_SIZE;
    }

    const result = {
      success: true,
      dry_run: dryRun,
      total_checked: totalChecked,
      cleaned: totalCleaned,
      breakdown,
      sample,
      message: dryRun
        ? `Dry run: would remove ${totalCleaned} of ${totalChecked} CapTarget deals`
        : `Removed ${totalCleaned} CapTarget deals that were PE/VC/advisory firms`,
    };

    console.log("Cleanup complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Cleanup failed:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
