import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  score_id: string;
  buyer_id: string;
  listing_id: string;
  composite_score: number;
  tier?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NotifyRequest = await req.json();
    const { score_id, buyer_id, listing_id, composite_score, tier } = body;

    console.log(`Processing A-tier notification for score ${score_id}`);

    // Fetch buyer details
    const { data: buyer, error: buyerError } = await supabase
      .from("remarketing_buyers")
      .select("company_name, company_website")
      .eq("id", buyer_id)
      .single();

    if (buyerError) {
      console.error("Failed to fetch buyer:", buyerError);
      throw new Error("Buyer not found");
    }

    // Fetch listing details
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("title, category, location")
      .eq("id", listing_id)
      .single();

    if (listingError) {
      console.error("Failed to fetch listing:", listingError);
      throw new Error("Listing not found");
    }

    // Fetch all admin users
    const { data: admins, error: adminsError } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    if (adminsError) {
      console.error("Failed to fetch admins:", adminsError);
      throw new Error("Failed to fetch admins");
    }

    if (!admins || admins.length === 0) {
      console.log("No admins to notify");
      return new Response(
        JSON.stringify({ success: true, message: "No admins to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create notifications for all admins
    const notifications = admins.map((admin) => ({
      admin_id: admin.id,
      notification_type: "remarketing_a_tier_match",
      title: `🎯 A-Tier Match: ${buyer.company_name}`,
      message: `${buyer.company_name} scored ${Math.round(composite_score)} for "${listing.title}" - recommended for outreach`,
      action_url: `/admin/remarketing/matching/${listing_id}?highlight=${score_id}`,
      metadata: {
        score_id,
        buyer_id,
        listing_id,
        composite_score,
        tier: tier || "A",
        buyer_name: buyer.company_name,
        listing_title: listing.title,
      },
      is_read: false,
    }));

    const { error: insertError } = await supabase
      .from("admin_notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Failed to create notifications:", insertError);
      throw new Error("Failed to create notifications");
    }

    console.log(`Created ${notifications.length} A-tier match notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: notifications.length,
        buyer: buyer.company_name,
        listing: listing.title,
        score: composite_score
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Notify remarketing match error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
