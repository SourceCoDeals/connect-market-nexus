

# Fix Webflow Webhook: Remove Secret Auth + Filter Deal Memo Forms Only

## Problem

The webhook is firing but every request fails with "Webhook auth failed" because:
- The URL was set as `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/ingest-webflow-deal-lead` (no `?secret=` param)
- You can't edit the webhook URL in Webflow after creation
- All forms across the site are firing, but we only want deal memo forms

## Fix

Update the edge function with two changes:

### 1. Remove secret-based authentication
Since Webflow doesn't support custom headers or query params in their webhook UI, remove the `?secret=` check entirely. The risk is minimal — the endpoint only creates `pending` connection requests that require admin approval. As an alternative lightweight guard, we validate the payload looks like a genuine Webflow V2 form submission (has `triggerType` and `payload` fields).

### 2. Filter to deal memo forms only
Check the `pageUrl` in the payload — only process submissions where the page URL contains `/off-market-deal-memos/`. All other form submissions (contact page, newsletter, etc.) get a 200 OK response but are silently skipped. This prevents non-deal forms from polluting connection requests.

## Changes

| File | Change |
|------|--------|
| `supabase/functions/ingest-webflow-deal-lead/index.ts` | Remove secret auth check (lines 13-19), add Webflow payload validation, add `/off-market-deal-memos/` page URL filter |

## What happens after deployment

- Webflow will retry recent failed deliveries automatically
- Future form submissions on deal memo pages will flow into connection requests
- Non-deal forms are ignored with a 200 response (so Webflow doesn't keep retrying)
- You'll still need to map `webflow_slug` on your listings to associate leads with the right deals

