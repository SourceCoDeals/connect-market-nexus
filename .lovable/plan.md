

## Plan: Add Clay Phone Number Lookup Tool

### Summary
Mirror the existing `clay_find_email` pattern to add a `clay_find_phone` tool that sends LinkedIn URLs to a new Clay phone lookup table and receives results via an inbound webhook. No auth/secret requirements on the webhook endpoint.

### Changes

**1. Database Migration — Add `result_phone` column to `clay_enrichment_requests`**
- Add `result_phone TEXT` column so the tracking table can store phone results alongside email results.

**2. `supabase/functions/_shared/clay-client.ts` — Add phone webhook URL + sender**
- Add `phone` key to `CLAY_WEBHOOK_URLS` with endpoint: `https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-fd39ed9a-ae2f-4ecd-8f8d-dd8d3740a6c9`
- Add `sendToClayPhone(params: { requestId, linkedinUrl })` function (same pattern as `sendToClayLinkedIn`)
- Update file header doc to mention the third flow (LinkedIn URL → phone)

**3. New edge function: `supabase/functions/clay-webhook-phone/index.ts`**
- Exact same structure as `clay-webhook-linkedin/index.ts` but:
  - Extracts `phone` from payload instead of `email`
  - Updates `result_phone` on the tracking row (plus `result_data`, `raw_callback_payload`)
  - Updates `enriched_contacts.phone` and `contacts.phone` instead of email
  - Source: `clay_phone`
  - Header comment: **NO auth/secret/signature check — DO NOT re-add**

**4. `supabase/config.toml` — Add webhook config**
- Add `[functions.clay-webhook-phone]` with `verify_jwt = false`

**5. `supabase/functions/ai-command-center/tools/integration/clay-tools.ts` — Add phone tool**
- Add `clayLookupPhone` helper (mirrors `clayLookupEmail` but uses `sendToClayPhone`, polls for `result_phone`, returns phone)
- Add `ClayPhoneLookupResult` type: `{ phone: string | null; source: string; requestId: string; timedOut?: boolean }`
- Add `clay_find_phone` tool definition (LinkedIn URL only, no name+domain mode)
- Add `clayFindPhone` executor function
- Export from `clayToolDefinitions` array

**6. `supabase/functions/ai-command-center/tools/integration/index.ts` — Re-export**
- Add `clayFindPhone`, `clayLookupPhone` to exports

**7. `supabase/functions/ai-command-center/tools/integration-action-tools.ts` — Wire executor**
- Add `case 'clay_find_phone'` to the switch, calling `clayFindPhone`

**8. `supabase/functions/ai-command-center/tools/index.ts` — Register in tool categories**
- Add `'clay_find_phone'` alongside `'clay_find_email'` in GENERAL, CONTACTS, CONTACT_ENRICHMENT, REMARKETING, and ENRICHMENT_TOOLS categories

**9. `supabase/functions/ai-command-center/system-prompt.ts` — Update AI instructions**
- Add phone lookup guidance: "Use `clay_find_phone` to find a person's phone number via their LinkedIn URL. Works the same as `clay_find_email` but returns a phone number."

**10. Test — Send test request to Clay**
- After deploying, call the Clay phone webhook with the example LinkedIn URL (`https://www.linkedin.com/in/tomos-mughan`) to verify the outbound flow works.
- Share the inbound webhook URL: `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/clay-webhook-phone`

