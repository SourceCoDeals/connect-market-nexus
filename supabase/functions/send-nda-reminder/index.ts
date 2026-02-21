import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

/**
 * send-nda-reminder
 * Daily cron job that sends NDA signing reminders via Brevo.
 * - 3-day reminder: first nudge after NDA was sent
 * - 7-day reminder: second nudge with escalation tone
 * Only targets firms with pending DocuSeal NDA status.
 */

serve(async (req: Request) => {
  // This is a cron job — no CORS, no auth needed (called by pg_cron)
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("❌ BREVO_API_KEY not configured");
      return new Response(JSON.stringify({ error: "BREVO_API_KEY not set" }), { status: 500 });
    }

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysWindow = new Date(now.getTime() - 3.5 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysWindow = new Date(now.getTime() - 7.5 * 24 * 60 * 60 * 1000).toISOString();

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
      return new Response(JSON.stringify({ error: queryError.message }), { status: 500 });
    }

    if (!pendingFirms?.length) {
      console.log("✅ No pending NDAs to remind");
      return new Response(JSON.stringify({ success: true, reminders: 0 }), { status: 200 });
    }

    let remindersSent = 0;
    const results: any[] = [];

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

      // Check if we already sent this reminder
      const { data: existingLog } = await supabase
        .from("docuseal_webhook_log")
        .select("id")
        .eq("external_id", firm.id)
        .eq("event_type", `nda_reminder_${reminderType}`)
        .maybeSingle();

      if (existingLog) {
        console.log(`⏭️ Already sent ${reminderType} reminder for ${firm.primary_company_name}`);
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
        console.log(`⚠️ No email found for firm ${firm.primary_company_name}`);
        continue;
      }

      // Build reminder email
      const subject =
        reminderType === "3-day"
          ? `Reminder: NDA Pending — ${firm.primary_company_name} | SourceCo`
          : `Action Required: NDA Still Pending — ${firm.primary_company_name} | SourceCo`;

      const htmlContent =
        reminderType === "3-day"
          ? `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
              <p>Hi ${recipientName},</p>
              <p>This is a friendly reminder that your NDA for <strong>${firm.primary_company_name}</strong> is still pending signature.</p>
              <p>Please check your email for the DocuSeal signing link, or reply to this email if you have any questions.</p>
              <br>
              <p>Best regards,<br><strong>SourceCo Team</strong></p>
            </div>`
          : `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
              <p>Hi ${recipientName},</p>
              <p>We noticed the NDA for <strong>${firm.primary_company_name}</strong> hasn't been signed yet. It's been a week since we sent it over.</p>
              <p>To continue accessing deal information, please sign the NDA at your earliest convenience. If you're experiencing any issues with the signing process, please let us know.</p>
              <br>
              <p>Best regards,<br><strong>SourceCo Team</strong></p>
            </div>`;

      try {
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify({
            sender: { name: "SourceCo", email: "noreply@sourcecodeals.com" },
            to: [{ email: recipientEmail, name: recipientName }],
            subject,
            htmlContent,
            textContent: htmlContent.replace(/<[^>]*>/g, ""),
          }),
        });

        if (brevoResponse.ok) {
          remindersSent++;
          results.push({
            firm: firm.primary_company_name,
            type: reminderType,
            email: recipientEmail,
            success: true,
          });

          // Log the reminder
          await supabase.from("docuseal_webhook_log").insert({
            event_type: `nda_reminder_${reminderType}`,
            external_id: firm.id,
            document_type: "nda",
            submission_id: null,
            raw_payload: { recipient: recipientEmail, reminder_type: reminderType },
            processed_at: new Date().toISOString(),
          });

          console.log(`✅ Sent ${reminderType} reminder to ${recipientEmail} for ${firm.primary_company_name}`);
        } else {
          const errorText = await brevoResponse.text();
          console.error(`❌ Brevo error for ${recipientEmail}:`, errorText);
          results.push({ firm: firm.primary_company_name, type: reminderType, success: false, error: errorText });
        }
      } catch (emailError: any) {
        console.error(`❌ Email error for ${recipientEmail}:`, emailError);
        results.push({ firm: firm.primary_company_name, type: reminderType, success: false, error: emailError.message });
      }
    }

    console.log(`📊 Reminder batch complete: ${remindersSent} sent out of ${pendingFirms.length} pending`);

    return new Response(
      JSON.stringify({
        success: true,
        totalPending: pendingFirms.length,
        remindersSent,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Error in send-nda-reminder:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
