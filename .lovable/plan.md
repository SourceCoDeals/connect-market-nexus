

# Auto-Associate Webflow Leads with Deals Going Forward

## Current State

The edge function extracts the URL slug from Webflow (e.g. `municipal-meter-installation-services`) and matches it against `listings.webflow_slug`. This works — but only if someone manually sets `webflow_slug` on each listing via SQL.

## Solution: Add `webflow_slug` field to the listing editor UI

When you create a new Webflow deal memo page, the URL slug (the last part of `/off-market-deal-memos/your-slug-here`) needs to match. The simplest fix is exposing `webflow_slug` in the admin listing editor so you can paste the slug when creating or editing a deal.

## What to build

### 1. Add Webflow Slug field to the listing editor form

In the existing listing editor (the form used in the Marketplace Queue / deal editing UI), add a text input labeled **"Webflow Page Slug"** with helper text: *"The URL slug from your Webflow deal memo page (e.g. `municipal-meter-installation-services`)"*

This goes in the listing detail/edit form alongside other metadata fields.

### 2. Save `webflow_slug` on listing create/update

Wire the field into the existing save mutation so it persists to `listings.webflow_slug`. No migration needed — the column already exists.

## Files to change

| File | Change |
|------|--------|
| Listing editor component (the form that edits listing metadata) | Add "Webflow Page Slug" text input bound to `webflow_slug` |
| Listing save hook/mutation | Include `webflow_slug` in the upsert payload |

## Workflow going forward

1. Create a new deal memo page in Webflow (e.g. `/off-market-deal-memos/new-deal-slug`)
2. In your admin listing editor, paste `new-deal-slug` into the Webflow Page Slug field and save
3. All form submissions from that Webflow page automatically match to the correct listing

No database changes needed. No edge function changes needed.

