

# Webflow Deal Memo Leads → Connection Request Management

## Overview

Webflow form submissions from deal memo pages (e.g. `/off-market-deal-memos/infrastructure-services-contractor`) need to flow into your connection request management system. Since forms currently live in Webflow's native inbox, we need a webhook endpoint that Webflow can POST to.

## Architecture

```text
Webflow Form Submit
  → Webflow Webhook (native or via form action override)
  → Edge Function: ingest-webflow-deal-lead
  → Screen lead email against profiles table
  → Match to listing (by deal memo slug/title mapping)
  → Insert into connection_requests
  → Trigger admin notification
  → Shows up in /admin/marketplace/requests
```

## How the Matching Works

### 1. Deal Matching (Form → Listing)
Each Webflow deal memo page has a unique slug (e.g. `infrastructure-services-contractor`). The webhook payload will include the page URL or a hidden field with the deal identifier. We'll create a simple lookup table `webflow_deal_mappings` that maps Webflow page slugs to listing IDs. Alternatively, we can store a `webflow_slug` column on the `listings` table directly.

### 2. Lead Screening (Email → Existing User)
When a form comes in, the edge function:
- Queries `profiles` by email
- If a match is found: sets `user_id` on the connection request (associates with existing buyer)
- If no match: creates a lead-only connection request using `lead_name`, `lead_email`, `lead_phone`, `lead_company`, `lead_role` fields (same pattern as your existing landing page / inbound lead flow)

## What Needs to Be Built

### A. New Edge Function: `ingest-webflow-deal-lead`
- Accepts POST with fields: `name`, `email`, `phone`, `company`, `role`, `interest_message`, `page_url` (or `deal_slug`)
- Validates with a shared secret header to prevent spam
- Looks up listing by slug mapping
- Checks `profiles` table for existing user by email
- Inserts into `connection_requests` with:
  - `source = 'webflow_deal_memo'`
  - `source_metadata = { page_url, form_data, ... }`
  - `user_id` if profile exists, otherwise null + lead fields
  - `listing_id` from the slug mapping
  - `status = 'pending'`
- Calls `send-connection-notification` for admin alert
- Deduplication: if same email + same listing already has a connection request, merge/update instead of creating a duplicate

### B. Database: Add `webflow_slug` to `listings`
Add a nullable `webflow_slug` text column to `listings` so each deal can be linked to its Webflow page. For example, listing "Asphalt Paving Contractor" (ID `922230bc-...`) gets slug `infrastructure-services-contractor`.

Alternatively, create a small mapping table. The column approach is simpler since it's 1:1.

### C. Webflow Configuration
You'll need to configure Webflow to send form submissions to the edge function URL. Two options:
- **Webflow Webhooks** (site settings → integrations → webhooks → "Form submission" trigger) — sends all form data as JSON POST
- **Custom form action** — override the form's action URL to point to the edge function

The Webflow webhook approach is cleanest since it doesn't require modifying the form HTML.

### D. Admin Dashboard — Already Works
Connection requests with `source = 'webflow_deal_memo'` will automatically appear in `/admin/marketplace/requests` because the query fetches all connection requests. The `source` badge will show "Webflow" and all lead fields (name, email, phone, company, role) will display in the existing UI.

## Files to Create/Change

| File | Change |
|------|--------|
| `supabase/functions/ingest-webflow-deal-lead/index.ts` | New edge function: validate, match deal, screen email, insert connection request |
| DB migration | Add `webflow_slug` column to `listings` + populate for existing deal memo pages |
| `src/types/admin.ts` | Add `'webflow_deal_memo'` to the source type union (if not already flexible) |

## Webflow Setup Steps (for you)
1. After the edge function is deployed, go to your Webflow project → Site Settings → Integrations → Webhooks
2. Add a webhook with trigger "Form submission" pointing to: `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/ingest-webflow-deal-lead`
3. Set a shared secret header for authentication (we'll configure this as an edge function secret)
4. Map each listing's `webflow_slug` to the corresponding deal memo page slug

## Security
- Webhook authenticated via `x-webhook-secret` header (stored as edge function secret)
- Input validation on all fields
- Deduplication prevents duplicate connection requests
- No RLS bypass needed — uses service role for insertion

## What Happens When a Lead Comes In
1. Lead fills out form on Webflow deal memo page
2. Webflow fires webhook to edge function
3. Edge function matches the deal, screens the email
4. Connection request appears in admin dashboard with full context
5. If the lead already has a marketplace profile, the request is linked to their account
6. Admin can approve/reject/follow up using existing workflow

