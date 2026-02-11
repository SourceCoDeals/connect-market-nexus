import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const body = await req.json();
    const { action, shareToken, password } = body;

    // Hash password utility (used by admin when creating partners)
    if (action === "hash-password") {
      if (!password) {
        return new Response(
          JSON.stringify({ error: "Password required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const hash = bcrypt.hashSync(password);
      return new Response(
        JSON.stringify({ hash }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate share token + password
    if (action === "validate") {
      if (!shareToken || !password) {
        return new Response(
          JSON.stringify({ error: "Share token and password required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: partner, error } = await supabase
        .from("referral_partners")
        .select("id, name, company, is_active, share_password_hash")
        .eq("share_token", shareToken)
        .single();

      if (error || !partner) {
        return new Response(
          JSON.stringify({ valid: false, error: "Invalid link" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!partner.is_active) {
        return new Response(
          JSON.stringify({ valid: false, error: "This tracker is no longer active" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check password — SECURITY: never fall back to plaintext comparison
      let valid = false;
      if (!partner.share_password_hash) {
        // No password set yet — accept any non-empty password and hash it
        const hash = bcrypt.hashSync(password);
        await supabase
          .from("referral_partners")
          .update({ share_password_hash: hash })
          .eq("id", partner.id);
        valid = true;
      } else {
        try {
          valid = bcrypt.compareSync(password, partner.share_password_hash);
        } catch (e) {
          // Hash is malformed — reject the attempt, do NOT fall back to plaintext
          console.error("bcrypt.compareSync threw for partner", partner.id, e);
          valid = false;
        }
      }

      if (!valid) {
        return new Response(
          JSON.stringify({ valid: false, error: "Invalid password" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update last_viewed_at
      await supabase
        .from("referral_partners")
        .update({ last_viewed_at: new Date().toISOString() })
        .eq("id", partner.id);

      return new Response(
        JSON.stringify({
          valid: true,
          partner: { name: partner.name, company: partner.company },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get data for authenticated partner
    if (action === "get-data") {
      if (!shareToken || !password) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Re-validate password
      const { data: partner, error } = await supabase
        .from("referral_partners")
        .select("id, name, company, is_active, share_password_hash")
        .eq("share_token", shareToken)
        .single();

      if (error || !partner || !partner.is_active) {
        return new Response(
          JSON.stringify({ error: "Invalid or inactive link" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: never fall back to plaintext comparison
      let valid = false;
      if (!partner.share_password_hash) {
        valid = false; // Must set password via validate action first
      } else {
        try {
          valid = bcrypt.compareSync(password, partner.share_password_hash);
        } catch (e) {
          console.error("bcrypt.compareSync threw for partner", partner.id, e);
          valid = false;
        }
      }

      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Invalid password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch listings for this partner (capped to prevent unbounded responses)
      const { data: listings } = await supabase
        .from("listings")
        .select(
          "id, title, internal_company_name, category, revenue, ebitda, full_time_employees, location, status, is_priority_target, website, deal_total_score, main_contact_name, main_contact_title, main_contact_email, linkedin_employee_count, linkedin_employee_range"
        )
        .eq("referral_partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(500);

      // Fetch submissions for this partner (capped)
      const { data: submissions } = await supabase
        .from("referral_submissions")
        .select(
          "id, company_name, industry, revenue, ebitda, location, status, listing_id, created_at"
        )
        .eq("referral_partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(500);

      // Update last_viewed_at
      await supabase
        .from("referral_partners")
        .update({ last_viewed_at: new Date().toISOString() })
        .eq("id", partner.id);

      return new Response(
        JSON.stringify({
          partner: { name: partner.name, company: partner.company },
          listings: listings || [],
          submissions: submissions || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-referral-access error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
