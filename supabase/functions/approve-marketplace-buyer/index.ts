/**
 * approve-marketplace-buyer: Approves a pending marketplace buyer request
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAdmin, escapeHtml } from "../_shared/auth.ts";
import { sendEmail } from "../_shared/email-sender.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const auth = await requireAdmin(req, supabaseAdmin);
  if (!auth.isAdmin) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.authenticated ? 403 : 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const approval_queue_id = body.approval_queue_id || body.queue_entry_id;
    const release_notes = body.release_notes;

    if (!approval_queue_id) {
      return new Response(JSON.stringify({ error: "approval_queue_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: queueRecord, error: queueError } = await supabaseAdmin
      .from("marketplace_approval_queue")
      .update({ status: "approved", reviewed_by: auth.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", approval_queue_id).eq("status", "pending").select().single();

    if (queueError || !queueRecord) {
      return new Response(JSON.stringify({ error: "Record not found or already processed" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: teaser, error: teaserError } = await supabaseAdmin
      .from("deal_documents").select("*").eq("deal_id", queueRecord.deal_id)
      .eq("document_type", "anonymous_teaser").eq("is_current", true).eq("status", "active").single();

    if (teaserError || !teaser) {
      return new Response(JSON.stringify({ error: "No active Anonymous Teaser found for this deal." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: deal, error: dealError } = await supabaseAdmin
      .from("listings").select("id, project_name, title, internal_company_name").eq("id", queueRecord.deal_id).single();

    if (dealError || !deal) {
      return new Response(JSON.stringify({ error: "Deal not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!deal.project_name) {
      return new Response(JSON.stringify({ error: "Deal does not have a project_name set." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: trackedLink, error: linkError } = await supabaseAdmin
      .from("document_tracked_links").insert({
        deal_id: queueRecord.deal_id, document_id: teaser.id, buyer_id: queueRecord.matched_buyer_id || null,
        buyer_email: queueRecord.buyer_email, buyer_name: queueRecord.buyer_name, buyer_firm: queueRecord.buyer_firm || null, created_by: auth.userId,
      }).select().single();

    if (linkError || !trackedLink) {
      return new Response(JSON.stringify({ error: "Failed to create tracked link" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const baseUrl = Deno.env.get("BASE_URL") || "https://app.sourcecoconnect.com";
    const linkUrl = `${baseUrl}/view/${trackedLink.link_token}`;

    const { data: releaseLog, error: releaseError } = await supabaseAdmin
      .from("document_release_log").insert({
        deal_id: queueRecord.deal_id, document_id: teaser.id, buyer_id: queueRecord.matched_buyer_id || null,
        buyer_name: queueRecord.buyer_name, buyer_firm: queueRecord.buyer_firm || null, buyer_email: queueRecord.buyer_email,
        release_method: "tracked_link", released_by: auth.userId, tracked_link_id: trackedLink.id, release_notes: release_notes || null,
      }).select().single();

    if (releaseError || !releaseLog) {
      return new Response(JSON.stringify({ error: "Failed to create release log" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const projectName = escapeHtml(deal.project_name);
    const buyerName = escapeHtml(queueRecord.buyer_name);

    const emailResult = await sendEmail({
      templateName: 'marketplace_buyer_approval',
      to: queueRecord.buyer_email,
      toName: queueRecord.buyer_name,
      subject: `Project ${deal.project_name} — Investment Opportunity`,
      htmlContent: buildApprovalEmailHtml(projectName, buyerName, linkUrl),
      senderName: "SourceCo Deal Team",
      replyTo: Deno.env.get("ADMIN_NOTIFICATION_EMAIL") || "deals@sourcecodeals.com",
      isTransactional: true,
      metadata: { dealId: queueRecord.deal_id, approvalQueueId: approval_queue_id },
    });

    if (!emailResult.success) {
      console.error("Failed to send approval email:", emailResult.error);
    }

    await supabaseAdmin.from("marketplace_approval_queue").update({ release_log_id: releaseLog.id }).eq("id", approval_queue_id);

    return new Response(
      JSON.stringify({ success: true, link_url: linkUrl, release_log_id: releaseLog.id, email_sent: emailResult.success }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Approve marketplace buyer error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function buildApprovalEmailHtml(projectName: string, buyerName: string, linkUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { padding-bottom: 20px; border-bottom: 2px solid #6366f1; margin-bottom: 20px; }
  .header h1 { color: #1e293b; font-size: 22px; margin: 0; }
  .cta-button { display: inline-block; background: #6366f1; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
  .note { background: #f8fafc; border-left: 4px solid #6366f1; padding: 12px 16px; margin: 20px 0; font-size: 14px; color: #475569; }
  .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px; }
  .disclaimer { font-size: 12px; color: #94a3b8; margin-top: 20px; }
</style></head>
<body>
  <div class="header"><h1>Project ${projectName} — Investment Opportunity</h1></div>
  <div>
    <p>Dear ${buyerName},</p>
    <p>Thank you for your interest in this investment opportunity. We are pleased to share the Anonymous Teaser for <strong>Project ${projectName}</strong> with you.</p>
    <p>Please click the link below to review the investment summary:</p>
    <p><a href="${linkUrl}" class="cta-button">View Investment Teaser</a></p>
    <div class="note">This is a private, tracked link generated exclusively for you. Please do not share or forward this link.</div>
    <p>If this opportunity aligns with your investment criteria, please reply to this email to express your interest.</p>
  </div>
  <div class="signature"><p>SourceCo Deal Team<br>SourceCo</p></div>
  <div class="disclaimer"><p>This communication is confidential and intended solely for the named recipient.</p></div>
</body></html>`;
}
