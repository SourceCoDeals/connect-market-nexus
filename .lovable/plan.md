

## PhoneBurner Webhook Matching — Revised Plan

### What I Found

After examining all 104 webhook logs, cross-referencing against every relevant table in the system:

| Source | Matched webhook contacts | Out of 66 unique |
|--------|-------------------------|-------------------|
| `contact_list_members` (email) | 5 | 7.5% |
| `listings.main_contact_email` | 6 | 9% |
| `listings.main_contact_phone` | 7 | 10.6% |
| `contacts` table (email) | 5 | 7.5% |
| `phoneburner_sessions` (email/phone) | 2 | 3% |
| `remarketing_buyer_contacts` | 0 | 0% |
| `enriched_contacts` | 0 | 0% |
| **Combined (deduplicated)** | **7** | **~10%** |

**~90% of webhook contacts do not exist anywhere in our database.** They were imported into PhoneBurner from Salesforce (they all have `external_id` starting with `00QPk...`/`003Pk...`) and our webhook is receiving callbacks because we registered a callback URL during dial session creation. These contacts were never pushed through our system — they were already in PhoneBurner.

### The real matching strategy

Since we can't pull additional data from PhoneBurner, the solution must work with what the webhook payload provides: `first_name`, `last_name`, `primary_email`, `phone`, `phones[]`, `external_id` (Salesforce ID), and `custom_data` (when present).

**Three-part approach:**

### Part 1: Fix the webhook handler for future calls (highest impact)

Add a **multi-source waterfall** to the existing `phoneburner-webhook/index.ts` that runs when session matching fails:

1. **Session match** (existing, works when `request_id` is present) — keep as-is
2. **NEW: Email match against `contact_list_members`** — returns `entity_id` (listing)
3. **NEW: Email match against `listings.main_contact_email`** — returns listing `id`
4. **NEW: Phone match against `contact_list_members.contact_phone`** — returns `entity_id`
5. **NEW: Phone match against `listings.main_contact_phone`** — returns listing `id`
6. **Existing phone RPC fallback** (`resolve_phone_activity_link_by_phone`) — keep but make it last priority

This replaces the current flow where session match failure immediately falls through to the broad phone RPC.

### Part 2: Fix disposition mapping (quick fix)

In the webhook `call_end` handler, map `payload.status` → `disposition_label` when `payload.disposition` is null. Currently all recent calls show `disposition_label = NULL` even though `payload.status` has values like "No Answer", "Voicemail", etc.

### Part 3: Backfill historical activities

Run a SQL migration that:
- Clears incorrectly mapped `listing_id` values from the previous backfill (where the mapping came from the too-broad phone RPC)
- Re-runs matching using the new waterfall logic: email → `contact_list_members.contact_email` or `listings.main_contact_email`, then phone → `contact_list_members.contact_phone` or `listings.main_contact_phone`
- Backfills `disposition_label` from `payload.status` where currently NULL
- Accepts that ~90% of historical activities will remain unmapped — these contacts genuinely don't exist in our system

### Part 4: Fix session_contacts storage in push function

The push function creates one session per push, but `session_contacts` only stores 1 contact because the frontend calls the push function once per contact. Update `phoneburner-push-contacts` to store the `list_id` on the session record, enabling future lookups against the full contact list when session_contacts is incomplete.

### Files to change

- `supabase/functions/phoneburner-webhook/index.ts` — Add email/phone waterfall matching against `contact_list_members` and `listings`; fix disposition mapping
- `supabase/functions/phoneburner-push-contacts/index.ts` — Store `list_id` on session
- SQL migration — Backfill cleanup + disposition backfill

