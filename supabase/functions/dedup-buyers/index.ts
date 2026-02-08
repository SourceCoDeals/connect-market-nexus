import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables with buyer_id FK to remarketing_buyers
const FK_TABLES = [
  { table: 'remarketing_scores', column: 'buyer_id' },
  { table: 'outreach_records', column: 'buyer_id' },
  { table: 'buyer_transcripts', column: 'buyer_id' },
  { table: 'buyer_learning_history', column: 'buyer_id' },
  { table: 'remarketing_outreach', column: 'buyer_id' },
  { table: 'remarketing_buyer_contacts', column: 'buyer_id' },
  { table: 'pe_firm_contacts', column: 'buyer_id' },
  { table: 'pe_firm_contacts', column: 'pe_firm_id' },
  { table: 'platform_contacts', column: 'buyer_id' },
  { table: 'platform_contacts', column: 'platform_id' },
  { table: 'buyer_pass_decisions', column: 'buyer_id' },
  { table: 'buyer_approve_decisions', column: 'buyer_id' },
  { table: 'buyer_enrichment_queue', column: 'buyer_id' },
];

async function rePointOrDelete(supabase: any, table: string, column: string, fromId: string, toId: string) {
  try {
    const { error } = await supabase
      .from(table)
      .update({ [column]: toId })
      .eq(column, fromId);
    
    if (error) {
      // Unique constraint conflict — delete the dup reference instead
      await supabase.from(table).delete().eq(column, fromId);
    }
  } catch {
    try {
      await supabase.from(table).delete().eq(column, fromId);
    } catch { /* ignore */ }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dryRun = true } = await req.json();

    console.log(`Starting buyer dedup (dryRun: ${dryRun})`);

    // Fetch all active buyers (minimal fields for grouping)
    const { data: allBuyers, error: fetchError } = await supabase
      .from('remarketing_buyers')
      .select('id, company_name, pe_firm_name, company_website, platform_website, business_summary, thesis_summary, hq_city, geographic_footprint, target_geographies, target_services, total_acquisitions')
      .eq('archived', false);

    if (fetchError) throw fetchError;

    // Group by normalized name + pe_firm
    const groups = new Map<string, typeof allBuyers>();
    for (const buyer of allBuyers || []) {
      const key = `${(buyer.company_name || '').toLowerCase().trim()}|||${(buyer.pe_firm_name || '').toLowerCase().trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(buyer);
    }

    const dupGroups = Array.from(groups.entries()).filter(([_, buyers]) => buyers.length > 1);
    console.log(`Found ${dupGroups.length} duplicate groups`);

    if (dryRun) {
      const details = dupGroups.map(([_, buyers]) => {
        const scored = buyers.map(b => ({
          id: b.id,
          name: b.company_name,
          score: (b.business_summary ? 3 : 0) + (b.thesis_summary ? 3 : 0) + (b.company_website || b.platform_website ? 2 : 0) + (b.hq_city ? 1 : 0),
        })).sort((a, b) => b.score - a.score);

        return {
          keeperId: scored[0].id,
          keeperName: scored[0].name,
          mergedCount: scored.length - 1,
        };
      });

      return new Response(JSON.stringify({ dryRun: true, duplicateGroups: dupGroups.length, totalToMerge: details.reduce((s, d) => s + d.mergedCount, 0), details: details.slice(0, 20) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real run: process in batches
    let totalMerged = 0;

    for (const [_, buyers] of dupGroups) {
      const scored = buyers.map(b => ({
        buyer: b,
        score: (b.business_summary ? 3 : 0) + (b.thesis_summary ? 3 : 0) + (b.company_website || b.platform_website ? 2 : 0) + (b.hq_city ? 1 : 0) + (b.geographic_footprint?.length ? 1 : 0) + (b.target_services?.length ? 1 : 0),
      })).sort((a, b) => b.score - a.score);

      const keeper = scored[0].buyer;
      const dups = scored.slice(1).map(s => s.buyer);

      // Process all dups for this group in parallel per dup
      const promises = dups.map(async (dup) => {
        // Re-point all FK references (run all tables in parallel per dup)
        await Promise.all(FK_TABLES.map(({ table, column }) =>
          rePointOrDelete(supabase, table, column, dup.id, keeper.id)
        ));

        // Archive the duplicate
        await supabase.from('remarketing_buyers').update({ archived: true }).eq('id', dup.id);
      });

      await Promise.all(promises);
      totalMerged += dups.length;
      
      if (totalMerged % 10 === 0) {
        console.log(`Progress: ${totalMerged} merged so far`);
      }
    }

    console.log(`Dedup complete: ${dupGroups.length} groups, ${totalMerged} merged`);

    return new Response(JSON.stringify({
      dryRun: false,
      duplicateGroups: dupGroups.length,
      totalMerged,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Dedup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});