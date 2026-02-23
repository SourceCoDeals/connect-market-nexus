import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { logEmailDelivery } from "../_shared/email-logger.ts";

/**
 * send-nda-reminder
 * Daily cron job that sends NDA signing reminders via Brevo.
 * - 3-day reminder: first nudge after NDA was sent
 * - 7-day reminder: second nudge with escalation tone
 * Only targets firms with pending DocuSeal NDA status.
 */

serve(async (req: Request) => {
  // This is a cron job — verify shared secret to prevent unauthorized invocation
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("❌ BREVO_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500 });
    }

    const now = new Date();

    console.log("🔔 Running NDA reminder check...");

    // Find firms with pending NDA that was sent 3 or 7 days ago
    const { data: pendingFirms, error: queryError } = await supabase
      .from("firm_agreements")
      .select(`
        id, primary_company_name, email_domain,
        nda_docuseal_status, nda_email_sent_at
      `)
      .eq("nda_docuseal_status", "pending")
      .eq("nda_email_sent", true)
      .not("nda_email_sent_at", "is", null)
      .eq("nda_signed", false);

    if (queryError) {
      console.error("❌ Query error:", queryError);
      return new Response(JSON.stringify({ error: "Database query failed" }), { status: 500 });
    }

    if (!pendingFirms?.length) {
      console.log("✅ No pending NDAs to remind");
      return new Response(JSON.stringify({ success: true, reminders: 0 }), { status: 200 });
    }

    let remindersSent = 0;

    for (const firm of pendingFirms) {
      const sentAt = new Date(firm.nda_email_sent_at);
      const daysSinceSent = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24);

      let reminderType: "3-day" | "7-day" | null = null;

      if (daysSinceSent >= 6.5 && daysSinceSent <= 7.5) {
        reminderType = "7-day";
      } else if (daysSinceSent >= 2.5 && daysSinceSent <= 3.5) {
        reminderType = "3-day";
      }

      if (!reminderType) continue;

      // M3: Check if we already sent this reminder (dedup)
      const { data: existingLog } = await supabase
        .from("docuseal_webhook_log")
        .select("id")
        .eq("external_id", firm.id)
        .eq("event_type", `nda_reminder_${reminderType}`)
        .maybeSingle();

      if (existingLog) {
        continue;
      }

      // Find the contact email — get firm members
      const { data: members } = await supabase
        .from("firm_members")
        .select("user_id, user:profiles(email, first_name, last_name)")
        .eq("firm_id", firm.id)
        .limit(1);

      const member = members?.[0];
      const recipientEmail = (member?.user as any)?.email;
      const recipientName = [(member?.user as any)?.first_name, (member?.user as any)?.last_name]
        .filter(Boolean)
        .join(" ") || "there";

      if (!recipientEmail) {
        continue;
      }

      // Sanitize firm name for email content
      const safeFirmName = (firm.primary_company_name || "your company").replace(/<[^>]*>/g, "");
      const safeRecipientName = recipientName.replace(/<[^>]*>/g, "");

      // Build reminder email
      const subject =
        reminderType === "3-day"
          ? `Reminder: NDA Pending — ${safeFirmName} | SourceCo`
          : `Action Required: NDA Still Pending — ${safeFirmName} | SourceCo`;

      const htmlContent =
        reminderType === "3-day"
          ? `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
              <p>Hi ${safeRecipientName},</p>
              <p>This is a friendly reminder that your NDA for <strong>${safeFirmName}</strong> is still pending signature.</p>
              <p>Please check your email for the DocuSeal signing link, or reply to this email if you have any questions.</p>
              <br>
              <p>Best regards,<br><strong>SourceCo Team</strong></p>
            </div>`
          : `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
              <p>Hi ${safeRecipientName},</p>
              <p>We noticed the NDA for <strong>${safeFirmName}</strong> hasn't been signed yet. It's been a week since we sent it over.</p>
              <p>To continue accessing deal information, please sign the NDA at your earliest convenience. If you're experiencing any issues with the signing process, please let us know.</p>
              <br>
              <p>Best regards,<br><strong>SourceCo Team</strong></p>
            </div>`;

      try {
        // M1: Timeout on external API call
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let brevoResponse: Response;
        try {
          brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-key": brevoApiKey,
            },
            body: JSON.stringify({
              sender: { name: "SourceCo", email: Deno.env.get('NOREPLY_EMAIL') || 'noreply@sourcecodeals.com' },
              to: [{ email: recipientEmail, name: safeRecipientName }],
              subject,
              htmlContent,
              textContent: htmlContent.replace(/<[^>]*>/g, ""),
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        const reminderCorrelationId = crypto.randomUUID();

        if (brevoResponse.ok) {
          remindersSent++;

          // Log the reminder (dedup key for future checks)
          await supabase.from("docuseal_webhook_log").insert({
            event_type: `nda_reminder_${reminderType}`,
            external_id: firm.id,
            document_type: "nda",
            submission_id: "reminder",
            raw_payload: { reminder_type: reminderType },
            processed_at: new Date().toISOString(),
          });

          await logEmailDelivery(supabase, {
            email: recipientEmail,
            emailType: 'nda_reminder',
            status: 'sent',
            correlationId: reminderCorrelationId,
          });
        } else {
          const errorText = await brevoResponse.text();
          console.error(`❌ Brevo error for firm ${firm.id}:`, errorText);
          await logEmailDelivery(supabase, {
            email: recipientEmail,
            emailType: 'nda_reminder',
            status: 'failed',
            correlationId: reminderCorrelationId,
            errorMessage: errorText,
          });
        }
      } catch (emailError: any) {
        if (emailError.name === "AbortError") {
          console.error(`❌ Brevo timeout for firm ${firm.id}`);
        } else {
          console.error(`❌ Email error for firm ${firm.id}:`, emailError);
        }
        await logEmailDelivery(supabase, {
          email: recipientEmail,
          emailType: 'nda_reminder',
          status: 'failed',
          correlationId: crypto.randomUUID(),
          errorMessage: emailError.name === "AbortError" ? "Brevo API timeout" : emailError.message,
        });
      }
    }

    console.log(`📊 Reminder batch complete: ${remindersSent} sent out of ${pendingFirms.length} pending`);

    return new Response(
      JSON.stringify({
        success: true,
        totalPending: pendingFirms.length,
        remindersSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Error in send-nda-reminder:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
