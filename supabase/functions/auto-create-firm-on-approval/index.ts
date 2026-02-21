import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

/**
 * auto-create-firm-on-approval
 *
 * Called when admin approves a buyer. Ensures the buyer has:
 *   1. A firm_agreements row (creates one if missing)
 *   2. A firm_members link to that firm
 *   3. A prepared DocuSeal NDA submission (embedded, not emailed)
 *
 * Input: { user_id }
 * The function looks up the user's profile to get company/email info.
 */

interface ApprovalRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Auth check
  const auth = await requireAdmin(req, supabaseAdmin);
  if (!auth.isAdmin) {
    return new Response(
      JSON.stringify({ error: auth.error }),
      {
        status: auth.authenticated ? 403 : 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body: ApprovalRequest = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get buyer profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name, company_name, company, buyer_type")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyName = profile.company_name || profile.company || `${profile.first_name} ${profile.last_name}`.trim();
    const emailDomain = profile.email?.split("@")[1] || null;
    const normalizedName = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 2. Check if firm already exists (match by email domain or normalized company name)
    let firmId: string | null = null;

    // Try email domain match first
    if (emailDomain) {
      const { data: existingByDomain } = await supabaseAdmin
        .from("firm_agreements")
        .select("id")
        .eq("email_domain", emailDomain)
        .limit(1)
        .maybeSingle();

      if (existingByDomain) {
        firmId = existingByDomain.id;
      }
    }

    // Try normalized company name match
    if (!firmId && normalizedName) {
      const { data: existingByName } = await supabaseAdmin
        .from("firm_agreements")
        .select("id")
        .eq("normalized_company_name", normalizedName)
        .limit(1)
        .maybeSingle();

      if (existingByName) {
        firmId = existingByName.id;
      }
    }

    // 3. Create firm if none exists
    if (!firmId) {
      const { data: newFirm, error: createError } = await supabaseAdmin
        .from("firm_agreements")
        .insert({
          primary_company_name: companyName,
          normalized_company_name: normalizedName,
          email_domain: emailDomain,
          company_name_variations: [companyName],
          nda_signed: false,
          fee_agreement_signed: false,
          nda_docuseal_status: "not_sent",
          fee_docuseal_status: "not_sent",
        })
        .select("id")
        .single();

      if (createError) {
        console.error("[auto-create-firm] Failed to create firm:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create firm agreement record" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      firmId = newFirm.id;
      console.log(`[auto-create-firm] Created firm ${firmId} for ${companyName}`);
    }

    // 4. Check if firm_members link already exists
    const { data: existingMember } = await supabaseAdmin
      .from("firm_members")
      .select("id")
      .eq("firm_id", firmId)
      .eq("user_id", user_id)
      .maybeSingle();

    if (!existingMember) {
      const { error: memberError } = await supabaseAdmin
        .from("firm_members")
        .insert({
          firm_id: firmId,
          user_id: user_id,
          member_type: "marketplace_user",
          is_primary_contact: true,
        });

      if (memberError) {
        console.error("[auto-create-firm] Failed to create firm member:", memberError);
        // Non-fatal - continue
      } else {
        console.log(`[auto-create-firm] Linked user ${user_id} to firm ${firmId}`);
      }
    }

    // 5. Check if NDA needs DocuSeal submission
    const { data: firm } = await supabaseAdmin
      .from("firm_agreements")
      .select("nda_signed, nda_docuseal_status, nda_docuseal_submission_id")
      .eq("id", firmId)
      .single();

    let embedSrc: string | null = null;

    if (firm && !firm.nda_signed && !firm.nda_docuseal_submission_id) {
      // Prepare embedded NDA submission (don't send email - buyer will sign in-app)
      const docusealApiKey = Deno.env.get("DOCUSEAL_API_KEY");
      const ndaTemplateId = Deno.env.get("DOCUSEAL_NDA_TEMPLATE_ID");

      if (docusealApiKey && ndaTemplateId) {
        try {
          const externalId = `firm_${firmId}_nda`;
          const docusealResponse = await fetch("https://api.docuseal.com/submissions", {
            method: "POST",
            headers: {
              "X-Auth-Token": docusealApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              template_id: parseInt(ndaTemplateId),
              send_email: false,
              submitters: [
                {
                  role: "First Party",
                  email: profile.email,
                  name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email,
                  external_id: externalId,
                },
              ],
            }),
          });

          if (docusealResponse.ok) {
            const submitters = await docusealResponse.json();
            const submitter = Array.isArray(submitters) ? submitters[0] : submitters;
            embedSrc = submitter.embed_src;

            await supabaseAdmin
              .from("firm_agreements")
              .update({
                nda_docuseal_submission_id: String(submitter.submission_id || submitter.id),
                nda_docuseal_status: "sent",
                updated_at: new Date().toISOString(),
              })
              .eq("id", firmId);

            console.log(`[auto-create-firm] Prepared NDA submission for firm ${firmId}`);
          } else {
            console.error("[auto-create-firm] DocuSeal API error:", await docusealResponse.text());
          }
        } catch (docusealError: any) {
          console.error("[auto-create-firm] DocuSeal error:", docusealError.message);
          // Non-fatal - admin can trigger manually later
        }
      }
    }

    return new Response(
      JSON.stringify({
        firm_id: firmId,
        firm_created: !firmId,
        member_linked: true,
        nda_submission_prepared: !!embedSrc,
        embed_src: embedSrc,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[auto-create-firm] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
