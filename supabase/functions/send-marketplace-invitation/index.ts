/**
 * send-marketplace-invitation — Sends an invitation email to a non-marketplace
 * contact, inviting them to create a buyer account on the marketplace.
 *
 * Called from the admin panel's Non-Marketplace Users table.
 * Requires admin authentication.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { requireAdmin, escapeHtml } from "../_shared/auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface InvitationRequest {
  to: string;
  name: string;
  customMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth guard: admin only
    const auth = await requireAdmin(req, supabaseAdmin);
    if (!auth.isAdmin) {
      return new Response(
        JSON.stringify({ error: auth.error || "Admin access required" }),
        {
          status: auth.authenticated ? 403 : 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { to, name, customMessage }: InvitationRequest = await req.json();

    if (!to || !name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, name" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const signupUrl = `${supabaseUrl.replace('.supabase.co', '.vercel.app')}/signup`;
    const safeName = escapeHtml(name);
    const safeCustomMessage = customMessage ? escapeHtml(customMessage) : "";

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin: 0;">SourceCo Marketplace</h1>
          <p style="color: #666; font-size: 14px; margin-top: 4px;">Invitation to Join</p>
        </div>

        <p style="color: #333; font-size: 15px; line-height: 1.6;">Hi ${safeName},</p>

        <p style="color: #333; font-size: 15px; line-height: 1.6;">
          You've been invited to join the SourceCo Marketplace — a curated platform
          connecting qualified buyers with off-market, founder-led acquisition opportunities.
        </p>

        ${safeCustomMessage ? `
          <div style="background: #f8f9fa; border-left: 3px solid #0066cc; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #333; font-size: 14px; line-height: 1.5; margin: 0;">
              <strong>Personal note from the team:</strong><br/>
              ${safeCustomMessage}
            </p>
          </div>
        ` : ""}

        <p style="color: #333; font-size: 15px; line-height: 1.6;">
          As a marketplace member, you'll get access to:
        </p>

        <ul style="color: #333; font-size: 14px; line-height: 1.8; padding-left: 20px;">
          <li>Exclusive off-market deal listings</li>
          <li>Direct connection requests to deal teams</li>
          <li>Personalized deal matching based on your criteria</li>
          <li>Secure data room access for approved deals</li>
        </ul>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${signupUrl}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 15px;">
            Create Your Account
          </a>
        </div>

        <p style="color: #999; font-size: 13px; line-height: 1.5;">
          After signing up, your account will be reviewed by our team. Most accounts are approved within 1-2 business days.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />

        <p style="color: #999; font-size: 12px; text-align: center;">
          SourceCo Marketplace | <a href="mailto:deals@sourcecodeals.com" style="color: #0066cc;">deals@sourcecodeals.com</a>
        </p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "SourceCo Marketplace <noreply@sourcecodeals.com>",
      to: [to],
      subject: "You're Invited to the SourceCo Marketplace",
      html: emailHtml,
    });

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      return new Response(
        JSON.stringify({ error: "Failed to send invitation email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log the invitation
    await supabaseAdmin.from("non_marketplace_users").update({
      invitation_sent_at: new Date().toISOString(),
      invitation_sent_by: auth.userId,
    }).eq("email", to);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("send-marketplace-invitation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
