import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * send-nda-reminder
 *
 * Cron job (daily at 9 AM EST) that sends NDA signing reminders to
 * approved buyers who haven't signed their NDA yet.
 *
 * Reminder schedule:
 *   - 3-day reminder: Approved 3+ days ago, no NDA signed
 *   - 7-day reminder: Approved 7+ days ago, no NDA signed
 *
 * Deduplication: Skips buyers who received a reminder in the last 4 days.
 * Uses Brevo API for email delivery with signing link.
 *
 * No JWT verification - triggered by cron/service role.
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const handler = async (req: Request): Promise<Response> => {
  // Only accept POST (from cron or service call)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");

  if (!brevoApiKey) {
    console.error("[send-nda-reminder] BREVO_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Query approved buyers who haven't signed NDA
    // Join profiles -> firm_members -> firm_agreements
    const { data: unsignedBuyers, error: queryError } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        email,
        first_name,
        last_name,
        approval_status,
        updated_at
      `)
      .eq("approval_status", "approved")
      .eq("is_admin", false);

    if (queryError) {
      console.error("[send-nda-reminder] Query error:", queryError);
      return new Response(JSON.stringify({ error: "Failed to query buyers" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!unsignedBuyers || unsignedBuyers.length === 0) {
      console.log("[send-nda-reminder] No approved buyers found");
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let sentCount = 0;
    const errors: string[] = [];

    for (const buyer of unsignedBuyers) {
      try {
        // Check if this buyer's firm has an unsigned NDA
        const { data: memberData } = await supabaseAdmin
          .from("firm_members")
          .select("firm_id")
          .eq("user_id", buyer.id)
          .limit(1)
          .maybeSingle();

        if (!memberData) continue;

        const { data: firm } = await supabaseAdmin
          .from("firm_agreements")
          .select("id, nda_signed, nda_docuseal_submission_id, nda_docuseal_status")
          .eq("id", memberData.firm_id)
          .single();

        if (!firm || firm.nda_signed) continue;

        // Check approval date (use updated_at as proxy for approval time)
        const approvedAt = new Date(buyer.updated_at);
        const daysSinceApproval = (now.getTime() - approvedAt.getTime()) / (24 * 60 * 60 * 1000);

        // Only send at 3-day and 7-day marks
        if (daysSinceApproval < 3) continue;

        // Check for recent reminders (prevent spam)
        const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
        const { data: recentReminders } = await supabaseAdmin
          .from("docuseal_webhook_log")
          .select("id")
          .eq("external_id", `reminder_nda_${buyer.id}`)
          .gte("created_at", fourDaysAgo.toISOString())
          .limit(1);

        if (recentReminders && recentReminders.length > 0) continue;

        // Determine reminder type
        const reminderType = daysSinceApproval >= 7 ? "7-day" : "3-day";

        // Get or create DocuSeal submission for signing link
        let signingUrl = "https://marketplace.sourcecodeals.com/pending-approval";

        if (firm.nda_docuseal_submission_id) {
          // Use existing submission - buyer can sign on pending approval page
          signingUrl = "https://marketplace.sourcecodeals.com/pending-approval";
        }

        // Send reminder email via Brevo
        const buyerName = `${buyer.first_name || ""} ${buyer.last_name || ""}`.trim() || "there";

        const emailResponse = await fetch(BREVO_API_URL, {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: "SourceCo", email: "noreply@sourcecodeals.com" },
            to: [{ email: buyer.email, name: buyerName }],
            subject: `Action Required: Sign your NDA to access SourceCo deals`,
            htmlContent: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <p>Hi ${buyerName},</p>
                <p>Your SourceCo Marketplace account was approved ${Math.floor(daysSinceApproval)} days ago, but we noticed you haven't signed your NDA yet.</p>
                <p>To start browsing exclusive deal opportunities, you'll need to complete a quick NDA signing:</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${signingUrl}" style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Sign NDA & Access Deals
                  </a>
                </p>
                <p>The NDA signing takes less than a minute and gives you full access to our marketplace of vetted acquisition opportunities.</p>
                <p>If you have any questions, reply to this email or contact us at <a href="mailto:adam.haile@sourcecodeals.com">adam.haile@sourcecodeals.com</a>.</p>
                <p>Best,<br>The SourceCo Team</p>
              </div>
            `,
          }),
        });

        if (emailResponse.ok) {
          sentCount++;
          console.log(`[send-nda-reminder] Sent ${reminderType} reminder to ${buyer.email}`);

          // Log the reminder to prevent duplicates
          await supabaseAdmin.from("docuseal_webhook_log").insert({
            event_type: "nda_reminder_sent",
            submission_id: firm.nda_docuseal_submission_id || "none",
            external_id: `reminder_nda_${buyer.id}`,
            document_type: "nda",
            raw_payload: {
              reminder_type: reminderType,
              buyer_email: buyer.email,
              days_since_approval: Math.floor(daysSinceApproval),
            },
            processed_at: new Date().toISOString(),
          });
        } else {
          const errorText = await emailResponse.text();
          console.error(`[send-nda-reminder] Failed to send to ${buyer.email}:`, errorText);
          errors.push(`${buyer.email}: ${errorText}`);
        }
      } catch (buyerError: any) {
        console.error(`[send-nda-reminder] Error for buyer ${buyer.id}:`, buyerError.message);
        errors.push(`${buyer.id}: ${buyerError.message}`);
      }
    }

    console.log(`[send-nda-reminder] Complete: ${sentCount} sent, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ sent: sentCount, errors: errors.length, error_details: errors }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-nda-reminder] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
