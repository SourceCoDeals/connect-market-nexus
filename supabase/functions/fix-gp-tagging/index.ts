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
    const { csvCompanyNames } = await req.json();
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: currentGP, error: fetchError } = await supabaseAdmin
      .from("listings")
      .select("id, title")
      .eq("deal_source", "gp_partners");
    if (fetchError) throw fetchError;

    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const csvSet = new Set(csvCompanyNames.map((n: string) => normalize(n)));

    // Find wrongly tagged deals (in DB as gp_partners but NOT in CSV)
    const wronglyTagged = currentGP?.filter(d => !csvSet.has(normalize(d.title))) || [];
    
    // Revert wrongly tagged back to manual
    if (wronglyTagged.length > 0) {
      const ids = wronglyTagged.map(d => d.id);
      const { error } = await supabaseAdmin
        .from("listings")
        .update({ deal_source: "manual" })
        .in("id", ids);
      if (error) throw error;
    }

    // Remaining correctly tagged
    const correctlyTagged = currentGP?.filter(d => csvSet.has(normalize(d.title))) || [];

    return new Response(
      JSON.stringify({
        csvNamesProvided: csvCompanyNames.length,
        currentGPCount: currentGP?.length,
        wronglyTagged: wronglyTagged.map(d => d.title).sort(),
        revertedCount: wronglyTagged.length,
        correctlyTagged: correctlyTagged.map(d => d.title).sort(),
        correctCount: correctlyTagged.length,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
