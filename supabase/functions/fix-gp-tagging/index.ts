import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvCompanyNames, tagByIds } = await req.json();
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: any = {};

    // Tag specific IDs as gp_partners
    if (tagByIds?.length) {
      const { error } = await supabaseAdmin
        .from("listings")
        .update({ deal_source: "gp_partners", pushed_to_all_deals: false, is_internal_deal: true })
        .in("id", tagByIds);
      if (error) throw error;
      results.taggedByIdCount = tagByIds.length;
    }

    // Sync: ensure ONLY CSV names are gp_partners
    if (csvCompanyNames?.length) {
      const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const csvSet = new Set(csvCompanyNames.map((n: string) => normalize(n)));

      // Get ALL listings
      const { data: allListings, error: fetchError } = await supabaseAdmin
        .from("listings")
        .select("id, title, deal_source");
      if (fetchError) throw fetchError;

      // Find deals that SHOULD be gp_partners (title matches CSV) but aren't
      const needsTagging = allListings?.filter(d => csvSet.has(normalize(d.title)) && d.deal_source !== "gp_partners") || [];
      if (needsTagging.length > 0) {
        const { error } = await supabaseAdmin
          .from("listings")
          .update({ deal_source: "gp_partners", pushed_to_all_deals: false, is_internal_deal: true })
          .in("id", needsTagging.map(d => d.id));
        if (error) throw error;
      }

      // Find deals tagged gp_partners but NOT in CSV
      const wronglyTagged = allListings?.filter(d => d.deal_source === "gp_partners" && !csvSet.has(normalize(d.title))) || [];
      if (wronglyTagged.length > 0) {
        const { error } = await supabaseAdmin
          .from("listings")
          .update({ deal_source: "manual" })
          .in("id", wronglyTagged.map(d => d.id));
        if (error) throw error;
      }

      results.newlyTagged = needsTagging.map(d => d.title).sort();
      results.newlyTaggedCount = needsTagging.length;
      results.revertedCount = wronglyTagged.length;
      results.wronglyTagged = wronglyTagged.map(d => d.title).sort();
    }

    // Final count
    const { count } = await supabaseAdmin
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("deal_source", "gp_partners");
    results.finalGPCount = count;

    return new Response(
      JSON.stringify(results, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
