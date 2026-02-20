import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * DEPRECATED: This function now proxies to map-csv-columns with targetType='buyer'.
 *
 * The unified map-csv-columns function supports both 'buyer' and 'deal' target types,
 * has a richer field set (19 buyer fields vs 6 here), and better AI prompting.
 *
 * All new callers should invoke 'map-csv-columns' directly with { targetType: 'buyer' }.
 * This proxy exists to avoid breaking any hidden callers.
 *
 * NOTE: This function has zero known frontend callers as of 2026-02-19.
 */

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req);
  }

  console.log("[map-contact-columns] DEPRECATED — proxying to map-csv-columns");

  try {
    const { headers, sampleRows } = await req.json();

    if (!headers || !Array.isArray(headers)) {
      return new Response(
        JSON.stringify({ error: 'headers array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    // Convert sampleRows (string[][]) to sampleData (Record<string, string>[]) for map-csv-columns
    let sampleData: Record<string, string>[] | undefined;
    if (sampleRows && sampleRows.length > 0) {
      sampleData = sampleRows.map((row: string[]) => {
        const record: Record<string, string> = {};
        headers.forEach((h: string, i: number) => {
          record[h] = row[i] || '';
        });
        return record;
      });
    }

    const proxyResponse = await fetch(
      `${supabaseUrl}/functions/v1/map-csv-columns`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          columns: headers,
          targetType: 'buyer',
          sampleData,
        }),
      }
    );

    const result = await proxyResponse.json();

    // Convert array mappings back to Record<string, string> for legacy callers
    const mappings: Record<string, string> = {};
    if (Array.isArray(result.mappings)) {
      for (const m of result.mappings) {
        if (m.csvColumn) {
          mappings[m.csvColumn] = m.targetField || 'skip';
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, method: 'proxy', mappings }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[map-contact-columns] Proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
