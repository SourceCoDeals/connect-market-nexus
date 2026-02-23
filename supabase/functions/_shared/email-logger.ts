/**
 * Shared email delivery logger.
 *
 * Every edge function that sends email should call `logEmailDelivery()` after
 * the send attempt so that the admin-digest dashboard and delivery-monitoring
 * hooks can see a single, unified timeline of all outbound email.
 *
 * Usage:
 *   import { logEmailDelivery } from "../_shared/email-logger.ts";
 *
 *   // After a successful send:
 *   await logEmailDelivery(supabase, {
 *     email: recipientEmail,
 *     emailType: 'approval_email',
 *     status: 'sent',
 *     correlationId: crypto.randomUUID(),
 *   });
 *
 *   // After a failed send:
 *   await logEmailDelivery(supabase, {
 *     email: recipientEmail,
 *     emailType: 'approval_email',
 *     status: 'failed',
 *     correlationId,
 *     errorMessage: 'Brevo 503: service unavailable',
 *   });
 */

export async function logEmailDelivery(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  entry: EmailDeliveryLogEntry,
): Promise<void> {
  try {
    const { error } = await supabase.from("email_delivery_logs").insert({
      email: entry.email,
      email_type: entry.emailType,
      status: entry.status,
      correlation_id: entry.correlationId ?? crypto.randomUUID(),
      error_message: entry.errorMessage ?? null,
      sent_at: entry.status === "sent" ? new Date().toISOString() : null,
    });

    if (error) {
      console.warn("[email-logger] Failed to insert delivery log:", error.message);
    }
  } catch (err: any) {
    // Never throw — logging must not break the caller
    console.warn("[email-logger] Unexpected error:", err.message);
  }
}
