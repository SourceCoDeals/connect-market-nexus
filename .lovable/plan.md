

# Fix Webflow Lead Ingestion — Field Parsing + Slug Mapping

## Problem

Real leads are hitting the webhook but ALL fail with "No email found in form submission." The Webflow V2 payload sends form data as:

```json
{
  "data": {
    "Name": "Tucker Risman",
    "Email address": "tucker@mooseriverventures.com",
    "Company name": "Moose River Ventures",
    "Phone number": "2032496072",
    "Role": "Individual Investor",
    "Message": "..."
  }
}
```

The code's object-branch (line 63-71) only checks keys like `email`, `Email`, `phone`, `Phone` — never matching `"Email address"`, `"Company name"`, or `"Phone number"`.

Additionally, no listings have `webflow_slug` set, so even after fixing parsing, deals won't be linked.

## Fix

### 1. Fix field extraction in the object branch

Replace the simple key lookups (lines 63-71) with a loop that matches keys by substring, same approach already used for the array branch. This handles any Webflow field naming convention (`Email`, `Email address`, `Email Address`, `Your Email`, etc.).

### 2. Map webflow slugs for the 3 deals

| Webflow Slug | Listing Title | Listing ID |
|---|---|---|
| `municipal-meter-installation-services` | Municipal Meter Installation & Services - Mid Atlantic | `a6e20eba-...` |
| `florida-property-damage-restoration-emergency-services` | Protegrity Restoration | `d136656a-...` |
| `pacific-northwest-residential-window-door-exterior-services` | Clear Choice Windows and Doors | Need to pick correct one (`9f08d1a8` or `9827389b`) |

### 3. Auto-detection consideration

For future deals, slug matching already works automatically — you just need to set `webflow_slug` on the listing when you create the Webflow deal memo page. The form name in the payload (e.g. "Municipal Meter Installation & Services - East Coast - Deal Request (Saks)") could also be used as a fuzzy fallback, but slug matching is more reliable.

## Changes

| File | Change |
|------|--------|
| `supabase/functions/ingest-webflow-deal-lead/index.ts` | Rewrite object-branch field extraction (lines 63-71) to use key substring matching |
| Database (data update) | `UPDATE listings SET webflow_slug = '...' WHERE id = '...'` for the 3 deals |

## After deployment

Webflow will retry recent failed deliveries. The leads from Tucker Risman, Dan Wingard, and others shown in the logs should flow in automatically on retry — or you can submit a test form to verify.

