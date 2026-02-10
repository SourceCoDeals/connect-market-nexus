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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from auth token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { submissionId, action } = body;

    if (!submissionId || !action) {
      return new Response(
        JSON.stringify({ error: "submissionId and action required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return new Response(
        JSON.stringify({ error: 'action must be "approve" or "reject"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the submission
    const { data: submission, error: fetchError } = await supabase
      .from("referral_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (fetchError || !submission) {
      return new Response(
        JSON.stringify({ error: "Submission not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (submission.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Submission already reviewed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    if (action === "reject") {
      // Reject: just update status
      const { error: updateError } = await supabase
        .from("referral_submissions")
        .update({
          status: "rejected",
          reviewed_at: now,
          reviewed_by: user.id,
        })
        .eq("id", submissionId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, action: "rejected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Approve: create listing, then update submission
    const listingData: Record<string, unknown> = {
      title: submission.company_name,
      website: submission.website || null,
      category: submission.industry || "Other",
      revenue: submission.revenue || 0,
      ebitda: submission.ebitda || 0,
      location: submission.location || "Unknown",
      description: submission.company_name,
      status: "active",
      is_internal_deal: true,
      referral_partner_id: submission.referral_partner_id,
      main_contact_name: submission.contact_name || null,
      main_contact_email: submission.contact_email || null,
      main_contact_phone: submission.contact_phone || null,
    };

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .insert(listingData)
      .select("id, title")
      .single();

    if (listingError) throw listingError;

    // Update submission with listing link
    const { error: updateError } = await supabase
      .from("referral_submissions")
      .update({
        status: "approved",
        listing_id: listing.id,
        reviewed_at: now,
        reviewed_by: user.id,
      })
      .eq("id", submissionId);

    if (updateError) throw updateError;

    // Update partner deal count
    const { data: countData } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("referral_partner_id", submission.referral_partner_id);

    await supabase
      .from("referral_partners")
      .update({ deal_count: countData?.length || 0 })
      .eq("id", submission.referral_partner_id);

    // Queue for enrichment if website exists
    if (submission.website) {
      try {
        await supabase.from("enrichment_queue").upsert(
          {
            listing_id: listing.id,
            status: "pending",
            attempts: 0,
            queued_at: now,
          },
          { onConflict: "listing_id" }
        );

        // Trigger enrichment worker
        supabase.functions
          .invoke("process-enrichment-queue", {
            body: { source: "referral_approval" },
          })
          .catch(console.warn);
      } catch (e) {
        console.warn("Failed to queue enrichment:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, action: "approved", listing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("approve-referral-submission error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
