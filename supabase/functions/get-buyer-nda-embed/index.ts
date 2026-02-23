import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

/**
 * get-buyer-nda-embed
 * Buyer-facing endpoint: returns the DocuSeal embed_src for the buyer's NDA.
 * If no submission exists yet, creates one via DocuSeal API.
 * Only returns data for the authenticated buyer's own firm.
 */

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate buyer (any logged-in user)
    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = auth.userId;

    // Get buyer's firm membership
    const { data: membership } = await supabaseAdmin
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "No firm found for this buyer", hasFirm: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const firmId = membership.firm_id;

    // Get firm agreement
    const { data: firm } = await supabaseAdmin
      .from("firm_agreements")
      .select("id, nda_signed, nda_docuseal_submission_id, nda_docuseal_status")
      .eq("id", firmId)
      .single();

    if (!firm) {
      return new Response(
        JSON.stringify({ error: "Firm agreement not found", hasFirm: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // If already signed, no embed needed
    if (firm.nda_signed) {
      return new Response(
        JSON.stringify({ ndaSigned: true, embedSrc: null }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get buyer profile for email/name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", userId)
      .single();

    if (!profile?.email) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const buyerName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email;

    // If submission already exists, fetch embed_src from DocuSeal API
    const docusealApiKey = Deno.env.get("DOCUSEAL_API_KEY");
    if (!docusealApiKey) {
      return new Response(
        JSON.stringify({ error: "DocuSeal not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (firm.nda_docuseal_submission_id) {
      // Fetch submitter details to get embed_src (with timeout)
      const fetchController = new AbortController();
      const fetchTimeout = setTimeout(() => fetchController.abort(), 15000);
      let submitterRes: Response;
      try {
        submitterRes = await fetch(
          `https://api.docuseal.com/submitters?submission_id=${firm.nda_docuseal_submission_id}`,
          {
            headers: { "X-Auth-Token": docusealApiKey },
            signal: fetchController.signal,
          }
        );
      } finally {
        clearTimeout(fetchTimeout);
      }

      if (submitterRes.ok) {
        const submitters = await submitterRes.json();
        const data = Array.isArray(submitters?.data) ? submitters.data : Array.isArray(submitters) ? submitters : [];
        const submitter = data.find((s: any) => s.email === profile.email) || data[0];
        if (submitter?.embed_src) {
          return new Response(
            JSON.stringify({ ndaSigned: false, embedSrc: submitter.embed_src }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        // Self-heal: if DocuSeal says completed but our DB doesn't reflect it
        if (submitter?.status === 'completed') {
          const now = new Date().toISOString();
          const docUrl = submitter.documents?.[0]?.url || null;
          await supabaseAdmin
            .from("firm_agreements")
            .update({
              nda_signed: true,
              nda_signed_at: now,
              nda_docuseal_status: "completed",
              nda_status: "signed",
              ...(docUrl ? { nda_signed_document_url: docUrl, nda_document_url: docUrl } : {}),
              updated_at: now,
            })
            .eq("id", firmId);

          const { data: members } = await supabaseAdmin
            .from("firm_members")
            .select("user_id")
            .eq("firm_id", firmId);
          if (members?.length) {
            for (const member of members) {
              await supabaseAdmin
                .from("profiles")
                .update({ nda_signed: true, nda_signed_at: now, updated_at: now })
                .eq("id", member.user_id);
            }
          }

          console.log(`🔧 Self-healed: NDA for firm ${firmId} marked as signed (DocuSeal says completed)`);

          return new Response(
            JSON.stringify({ ndaSigned: true, embedSrc: null }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        // embed_src not in list response — fetch individual submitter
        if (submitter?.id) {
          const individualRes = await fetch(
            `https://api.docuseal.com/submitters/${submitter.id}`,
            { headers: { "X-Auth-Token": docusealApiKey } },
          );
          if (individualRes.ok) {
            const ind = await individualRes.json();
            if (ind?.embed_src) {
              return new Response(
                JSON.stringify({ ndaSigned: false, embedSrc: ind.embed_src }),
                { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
              );
            }
            if (ind?.slug) {
              return new Response(
                JSON.stringify({ ndaSigned: false, embedSrc: `https://docuseal.com/s/${ind.slug}` }),
                { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
              );
            }
          }
        }
        if (submitter?.slug) {
          return new Response(
            JSON.stringify({ ndaSigned: false, embedSrc: `https://docuseal.com/s/${submitter.slug}` }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    // No existing submission or couldn't get embed_src — create new submission
    const ndaTemplateId = Deno.env.get("DOCUSEAL_NDA_TEMPLATE_ID");
    if (!ndaTemplateId) {
      return new Response(
        JSON.stringify({ error: "NDA template not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const submissionPayload = {
      template_id: parseInt(ndaTemplateId),
      send_email: false,
      submitters: [
        {
          role: "First Party",
          email: profile.email,
          name: buyerName,
          external_id: firmId,
        },
      ],
    };

    const createController = new AbortController();
    const createTimeout = setTimeout(() => createController.abort(), 15000);
    let docusealResponse: Response;
    try {
      docusealResponse = await fetch("https://api.docuseal.com/submissions", {
        method: "POST",
        headers: {
          "X-Auth-Token": docusealApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionPayload),
        signal: createController.signal,
      });
    } finally {
      clearTimeout(createTimeout);
    }

    if (!docusealResponse.ok) {
      const errorText = await docusealResponse.text();
      console.error("❌ DocuSeal API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create signing form" }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await docusealResponse.json();
    const submitter = Array.isArray(result) ? result[0] : result;
    const submissionId = String(submitter.submission_id || submitter.id);
    const embedSrc = submitter.embed_src || null;

    // Update firm_agreements (also set nda_status to 'sent' for tracking)
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("firm_agreements")
      .update({
        nda_docuseal_submission_id: submissionId,
        nda_docuseal_status: "pending",
        nda_status: "sent",
        nda_sent_at: now,
        updated_at: now,
      })
      .eq("id", firmId);

    // Log
    await supabaseAdmin.from("docuseal_webhook_log").insert({
      event_type: "submission_created",
      submission_id: submissionId,
      document_type: "nda",
      external_id: firmId,
      raw_payload: { created_by_buyer: userId },
    });

    console.log(`✅ Created NDA submission ${submissionId} for buyer ${userId}`);

    return new Response(
      JSON.stringify({ ndaSigned: false, embedSrc }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("❌ Error in get-buyer-nda-embed:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
