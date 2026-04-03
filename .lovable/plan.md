

# Deep Strategic Analysis — Why Emails Don't Work

## The Smoking Gun

The Brevo dashboard screenshots reveal everything:

**Screenshot 1 (Real-time):** Zero events, zero delivered, zero everything in the last 30 minutes.

**Screenshot 2 (Message logs):** The ONLY emails that ever worked are "Confirm Your Signup" — Supabase Auth's built-in confirmation emails. These are from March 31 and April 1. Nothing else has ever appeared in Brevo's logs.

## The Critical Difference

The "Confirm Your Signup" emails that work go through a **completely different pipeline** than every custom email in this app:

```text
WORKING (Auth emails):
  Supabase Auth → SMTP relay → Brevo SMTP → Gmail ✓
  (Configured in Supabase Dashboard → Auth → SMTP Settings)
  (Uses SMTP protocol, not REST API)

BROKEN (All custom emails):
  Edge Function → fetch('https://api.brevo.com/v3/smtp/email') → Brevo REST API → ???
  (API returns HTTP 201 + message ID, but email never appears in Brevo logs)
```

Brevo's REST API is **accepting the request and returning a message ID**, but the email is never actually queued for delivery. This is proven by:
- `outbound_emails` table shows `status: accepted` with valid provider message IDs
- Brevo real-time dashboard shows 0 events
- Brevo message logs show 0 custom emails ever

## Why Brevo REST API Accepts But Doesn't Send

The most likely causes (in order of probability):

1. **The BREVO_API_KEY belongs to a different Brevo account or sub-organization than the SMTP credentials.** Supabase Auth's SMTP was configured with specific SMTP credentials (username/password) pointed at a Brevo account where `adam.haile@sourcecodeals.com` is verified. The REST API key stored in Supabase secrets may be from a different Brevo workspace/account.

2. **The API key lacks transactional sending permissions.** Brevo API keys can be scoped. If the key only has "contacts" or "campaigns" scope but not "transactional" scope, the API would accept the call but silently not send.

3. **Brevo's transactional API might be on a different plan/tier** than the SMTP relay, and may not be activated for this account.

## Evidence Summary

| Signal | What it proves |
|--------|---------------|
| Auth signup emails work | SMTP path to Brevo works, sender is verified, DNS is good |
| Brevo dashboard shows 0 custom emails | REST API calls never actually queue emails |
| API returns 201 + message ID | API authentication works but sending is silently skipped |
| No webhook events | No emails = no delivery events to report |
| Brevo SMTP logs show auth emails only | Only SMTP-submitted emails are actually being processed |

## The Path Forward

There are two viable strategies:

### Strategy A: Use Lovable's Built-In Email Infrastructure (Recommended)

Stop using Brevo's REST API entirely. Set up a Lovable email domain and use the platform's native transactional email system.

- Lovable has a complete email pipeline: domain verification, DKIM/SPF, queue with retries, suppression, unsubscribe handling
- The "Confirm Your Signup" auth emails would also be customizable via auth-email-hook
- Zero dependency on Brevo API keys or Brevo account configuration
- All emails go through a verified, managed pipeline
- This is the standard, supported path for Lovable projects

**What this requires:**
1. Set up email domain (e.g., `notify.sourcecodeals.com`) — NS record delegation
2. Scaffold transactional email templates for all 10+ email types
3. Rewrite all edge functions to use `send-transactional-email` instead of direct Brevo calls
4. Scaffold auth-email-hook for branded signup/reset emails
5. Delete all Brevo-specific code

**Trade-off:** Requires DNS changes (NS records for subdomain). Auth emails would change from current SMTP to Lovable's pipeline. Attachments are NOT supported — must use download links instead.

### Strategy B: Fix the Brevo REST API Key

The simplest diagnostic: verify the BREVO_API_KEY actually corresponds to the same Brevo account where the SMTP credentials live.

- Go to Brevo Dashboard → SMTP & API → API Keys
- Compare the API key shown there with what's stored in Supabase secrets
- If they don't match, update the secret to the correct key
- If they do match, check API key permissions/scope

**What this requires:**
1. User verifies API key in Brevo dashboard
2. If wrong key: update secret, redeploy, test
3. If right key but wrong permissions: regenerate with full transactional scope

**Trade-off:** Keeps the existing architecture. Faster to test. But still relies on Brevo's REST API, still has the fragmented codebase, still needs the Phase 5-7 cleanup.

### Strategy C: Switch to SMTP Instead of REST API

Since Brevo's SMTP works (proven by auth emails), switch all custom edge functions to send via SMTP instead of REST API. Deno supports SMTP via libraries.

**Trade-off:** More work than fixing the API key. Less clean than Lovable's native system. Still Brevo-dependent.

## My Recommendation

**Start with Strategy B** — it's a 5-minute diagnostic. Have the user check if the Brevo API key matches the account where the SMTP credentials are configured. If it's a key mismatch, one secret update fixes everything.

**If Strategy B doesn't resolve it, go with Strategy A** — the Lovable email infrastructure is the proper long-term solution. It eliminates the Brevo dependency, provides managed deliverability, and aligns with the platform's supported architecture.

## Immediate Action Items for You (The User)

1. Go to Brevo Dashboard → SMTP & API → API Keys
2. Look at the API key(s) listed there
3. Check which Brevo account/organization you're in (top-right of Brevo dashboard)
4. Compare: Is the SMTP configured in Supabase Auth dashboard using credentials from the SAME Brevo account?
5. Tell me what you find — this will determine whether we do a quick fix or a full infrastructure switch

