/**
 * Shared Brevo email sending utility.
 *
 * Centralizes the Brevo SMTP API call so that edge functions don't each
 * duplicate the fetch logic, headers, and error handling.
 */

export interface BrevoEmailOptions {
  /** Recipient email address */
  to: string;
  /** Recipient display name */
  toName?: string;
  /** Email subject line */
  subject: string;
  /** HTML content */
  htmlContent: string;
  /** Plain text fallback (optional) */
  textContent?: string;
  /** Sender name (defaults to "SourceCo Notifications") */
  senderName?: string;
  /** Sender email (defaults to SENDER_EMAIL env var or notifications@sourcecodeals.com) */
  senderEmail?: string;
  /** Reply-to email (optional, defaults to sender) */
  replyToEmail?: string;
  /** Reply-to name (optional) */
  replyToName?: string;
  /** Disable click tracking (defaults to true to prevent broken links) */
  disableClickTracking?: boolean;
}

export interface BrevoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Brevo SMTP API.
 *
 * Requires BREVO_API_KEY environment variable.
 */
export async function sendViaBervo(options: BrevoEmailOptions): Promise<BrevoSendResult> {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    return { success: false, error: "BREVO_API_KEY is not set" };
  }

  const senderEmail = options.senderEmail
    || Deno.env.get("SENDER_EMAIL")
    || "notifications@sourcecodeals.com";
  const senderName = options.senderName || "SourceCo Notifications";

  const payload: Record<string, any> = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: options.to, name: options.toName || options.to }],
    subject: options.subject,
    htmlContent: options.htmlContent,
  };

  if (options.textContent) {
    payload.textContent = options.textContent;
  }

  if (options.replyToEmail) {
    payload.replyTo = {
      email: options.replyToEmail,
      name: options.replyToName || options.replyToEmail,
    };
  }

  if (options.disableClickTracking !== false) {
    payload.params = { trackClicks: false, trackOpens: true };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[brevo-sender] API error:", data);
      return { success: false, error: JSON.stringify(data) };
    }

    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    console.error("[brevo-sender] Fetch error:", err);
    return { success: false, error: err.message };
  }
}
