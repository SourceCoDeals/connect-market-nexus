import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Rate limit: 50 submissions per partner per hour
const RATE_LIMIT = 50;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function checkPartnerRateLimit(partnerId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

  const { count, error } = await supabase
    .from("referral_submissions")
    .select("*", { count: "exact", head: true })
    .eq("referral_partner_id", partnerId)
    .gte("created_at", windowStart);

  if (error) {
    console.error("Rate limit check error:", error);
    return true; // Fail open
  }

  return (count || 0) < RATE_LIMIT;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { shareToken, submission, submissions } = body;

    if (!shareToken) {
      return new Response(
        JSON.stringify({ error: "Share token required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate share token
    const { data: partner, error: partnerError } = await supabase
      .from("referral_partners")
      .select("id, is_active")
      .eq("share_token", shareToken)
      .single();

    if (partnerError || !partner) {
      return new Response(
        JSON.stringify({ error: "Invalid share link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!partner.is_active) {
      return new Response(
        JSON.stringify({ error: "This tracker is no longer active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    const allowed = await checkPartnerRateLimit(partner.id);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "3600",
          },
        }
      );
    }

    // Handle single or batch submissions
    const items = submissions || (submission ? [submission] : []);

    if (!items.length) {
      return new Response(
        JSON.stringify({ error: "No submissions provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and prepare rows
    const rows = [];
    for (const item of items) {
      if (!item.company_name || !item.company_name.trim()) continue;

      rows.push({
        referral_partner_id: partner.id,
        company_name: item.company_name.trim().substring(0, 500),
        website: item.website?.trim()?.substring(0, 500) || null,
        industry: item.industry?.trim()?.substring(0, 200) || null,
        revenue: typeof item.revenue === "number" ? item.revenue : null,
        ebitda: typeof item.ebitda === "number" ? item.ebitda : null,
        location: item.location?.trim()?.substring(0, 200) || null,
        contact_name: item.contact_name?.trim()?.substring(0, 200) || null,
        contact_email: item.contact_email?.trim()?.substring(0, 200) || null,
        contact_phone: item.contact_phone?.trim()?.substring(0, 50) || null,
        notes: item.notes?.trim()?.substring(0, 2000) || null,
        status: "pending",
      });
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ error: "No valid submissions (company name required)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert submissions
    const { error: insertError } = await supabase
      .from("referral_submissions")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, count: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("submit-referral-deal error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
