/**
 * PhoneBurner Push Contacts
 *
 * Pushes selected buyer contacts from SourceCo to a PhoneBurner dial session.
 * MVP flow: receive contact IDs → validate → map fields → push via PB API.
 *
 * Requires: User must have connected PhoneBurner via OAuth first.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const PB_API_BASE = "https://www.phoneburner.com/rest/1";

interface PushRequest {
  contact_ids: string[];       // buyer_contacts IDs
  session_name?: string;       // Name for new session
  skip_recent_days?: number;   // Skip contacts called within N days (default 7)
}

async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from("phoneburner_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenRow) return null;

  // Check if token is expired (with 5-min buffer)
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  // Refresh the token
  const clientId = Deno.env.get("PHONEBURNER_CLIENT_ID")!;
  const clientSecret = Deno.env.get("PHONEBURNER_CLIENT_SECRET")!;

  const res = await fetch("https://www.phoneburner.com/oauth/accesstoken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    console.error("Token refresh failed:", await res.text());
    return null;
  }

  const tokens = await res.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  await supabase
    .from("phoneburner_oauth_tokens")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || tokenRow.refresh_token,
      expires_at: newExpiresAt,
    })
    .eq("user_id", userId);

  return tokens.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Admin check
  const { data: isAdmin } = await supabase.rpc("is_admin", { user_id: user.id });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get PhoneBurner access token
  const pbToken = await getValidToken(supabase, user.id);
  if (!pbToken) {
    return new Response(
      JSON.stringify({ error: "PhoneBurner not connected. Please connect your account first.", code: "PB_NOT_CONNECTED" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const body: PushRequest = await req.json();
  const { contact_ids, session_name, skip_recent_days = 7 } = body;

  if (!contact_ids?.length) {
    return new Response(JSON.stringify({ error: "No contacts provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch contacts from buyer_contacts
  const { data: contacts, error: fetchError } = await supabase
    .from("buyer_contacts")
    .select("id, name, email, phone, title, linkedin_url, buyer_id, company_type, last_contacted_date")
    .in("id", contact_ids);

  if (fetchError || !contacts?.length) {
    return new Response(JSON.stringify({ error: "No contacts found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Also fetch buyer company names for context
  const buyerIds = [...new Set(contacts.map(c => c.buyer_id))];
  const { data: buyers } = await supabase
    .from("remarketing_buyers")
    .select("id, company_name, pe_firm_name, buyer_type, target_services, target_geographies")
    .in("id", buyerIds);

  const buyerMap = new Map((buyers || []).map(b => [b.id, b]));

  // Filter: skip recently contacted
  const skipCutoff = new Date(Date.now() - skip_recent_days * 24 * 60 * 60 * 1000);
  const eligible: typeof contacts = [];
  const excluded: { name: string; reason: string }[] = [];

  for (const contact of contacts) {
    if (!contact.phone) {
      excluded.push({ name: contact.name, reason: "No phone number" });
      continue;
    }
    if (contact.last_contacted_date && new Date(contact.last_contacted_date) > skipCutoff) {
      excluded.push({ name: contact.name, reason: `Contacted within ${skip_recent_days} days` });
      continue;
    }
    eligible.push(contact);
  }

  if (eligible.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        contacts_added: 0,
        contacts_excluded: excluded.length,
        exclusions: excluded,
        error: "All contacts were excluded",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Map contacts to PhoneBurner format and push one by one
  // (PhoneBurner REST API v1 uses POST /contacts for individual creates)
  let added = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const contact of eligible) {
    const buyer = buyerMap.get(contact.buyer_id);
    const nameParts = contact.name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const pbContact = {
      first_name: firstName,
      last_name: lastName,
      phone: contact.phone,
      email: contact.email || "",
      company: buyer?.company_name || "",
      title: contact.title || "",
      custom_fields: {
        sourceco_contact_id: contact.id,
        buyer_type: buyer?.buyer_type || "",
        pe_firm: buyer?.pe_firm_name || "",
        target_services: Array.isArray(buyer?.target_services) ? buyer.target_services.join(", ") : "",
        target_geographies: Array.isArray(buyer?.target_geographies) ? buyer.target_geographies.join(", ") : "",
        contact_source: "SourceCo Push to Dialer",
      },
    };

    try {
      const pbRes = await fetch(`${PB_API_BASE}/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pbToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pbContact),
      });

      if (pbRes.ok) {
        added++;
        // Update the contact's phoneburner sync status
        const pbData = await pbRes.json();
        if (pbData?.contacts?.[0]?.contact_id) {
          await supabase
            .from("buyer_contacts")
            .update({ salesforce_id: String(pbData.contacts[0].contact_id) }) // Repurpose salesforce_id for PB ID
            .eq("id", contact.id);
        }
      } else {
        const errBody = await pbRes.text();
        console.error(`PB push failed for ${contact.name}:`, errBody);
        errors.push(`${contact.name}: ${errBody.slice(0, 100)}`);
        failed++;
      }
    } catch (err) {
      console.error(`PB push error for ${contact.name}:`, err);
      errors.push(`${contact.name}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  // Log the push session
  await supabase.from("phoneburner_sessions").insert({
    session_name: session_name || `Push - ${new Date().toLocaleDateString()}`,
    session_type: "buyer_outreach",
    total_contacts_added: added,
    session_status: "active",
    created_by_user_id: user.id,
    started_at: new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({
      success: true,
      contacts_added: added,
      contacts_failed: failed,
      contacts_excluded: excluded.length,
      exclusions: excluded,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
