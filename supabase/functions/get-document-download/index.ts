import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Edge function to get a downloadable PDF URL for unsigned (or signed) documents.
 * Uses DocuSeal's GET /submissions/{id}/documents API.
 * 
 * Requires authenticated buyer session.
 * Query params: document_type=nda|fee_agreement
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const docusealApiKey = Deno.env.get("DOCUSEAL_API_KEY");

    if (!docusealApiKey) {
      return new Response(
        JSON.stringify({ error: "DocuSeal API not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Parse document type
    const url = new URL(req.url);
    const documentType = url.searchParams.get("document_type") || "nda";

    // Get user's firm
    const { data: membership } = await supabase
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "No firm found for user" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Get firm's submission ID
    const submissionField = documentType === "nda" ? "nda_docuseal_submission_id" : "fee_docuseal_submission_id";
    const documentUrlField = documentType === "nda" ? "nda_document_url" : "fee_agreement_document_url";
    const signedUrlField = documentType === "nda" ? "nda_signed_document_url" : "fee_signed_document_url";

    const { data: firm } = await supabase
      .from("firm_agreements")
      .select(`${submissionField}, ${documentUrlField}, ${signedUrlField}`)
      .eq("id", membership.firm_id)
      .maybeSingle();

    if (!firm) {
      return new Response(
        JSON.stringify({ error: "No firm agreement found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // If we already have a document URL cached, return it
    const existingUrl = (firm as any)[signedUrlField] || (firm as any)[documentUrlField];
    if (existingUrl) {
      return new Response(
        JSON.stringify({ url: existingUrl }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Fetch from DocuSeal API
    const submissionId = (firm as any)[submissionField];
    if (!submissionId) {
      // No submission exists — try to get template PDF instead
      const templateId = documentType === "nda"
        ? Deno.env.get("DOCUSEAL_NDA_TEMPLATE_ID")
        : Deno.env.get("DOCUSEAL_FEE_TEMPLATE_ID");

      if (!templateId) {
        return new Response(
          JSON.stringify({ error: "No document available for download" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      // Fetch template info to get document URLs
      const templateRes = await fetch(`https://api.docuseal.com/templates/${templateId}`, {
        headers: { "X-Auth-Token": docusealApiKey },
      });

      if (templateRes.ok) {
        const templateData = await templateRes.json();
        const docUrl = templateData?.documents?.[0]?.url;
        if (docUrl) {
          return new Response(
            JSON.stringify({ url: docUrl }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
      }

      return new Response(
        JSON.stringify({ error: "Template document not available" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Fetch submission documents from DocuSeal
    console.log(`📄 Fetching documents for submission ${submissionId}`);
    const docsRes = await fetch(
      `https://api.docuseal.com/submissions/${submissionId}/documents`,
      { headers: { "X-Auth-Token": docusealApiKey } },
    );

    if (!docsRes.ok) {
      const errText = await docsRes.text();
      console.error("❌ DocuSeal documents API error:", docsRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch document" }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const docsData = await docsRes.json();
    const documents = docsData?.documents || (Array.isArray(docsData) ? docsData : []);
    const docUrl = documents[0]?.url;

    if (!docUrl) {
      return new Response(
        JSON.stringify({ error: "No document found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Cache the URL in the firm record
    await supabase
      .from("firm_agreements")
      .update({ [documentUrlField]: docUrl, updated_at: new Date().toISOString() })
      .eq("id", membership.firm_id);

    console.log(`✅ Document URL retrieved and cached for firm ${membership.firm_id}`);

    return new Response(
      JSON.stringify({ url: docUrl }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
