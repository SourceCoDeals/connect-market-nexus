# Deal & Listings Data Architecture

This document explains the SourceCo data model for deals, listings, and the buyer pipeline. It clarifies naming conventions, the `source_deal_id` self-referential pattern, and column ownership rules established during the 2026-05 schema cleanup.

---

## Table of Contents

- [Core Tables](#core-tables)
- [The source\_deal\_id Pattern](#the-source_deal_id-pattern)
- [Column Ownership Rules](#column-ownership-rules)
- [Contact Data Flow](#contact-data-flow)
- [Schema Cleanup History](#schema-cleanup-history)

---

## Core Tables

### `listings` (the "company" or "deal" being sold)

This is the central table. Each row represents a business/company that is either:
- An **internal deal** (`is_internal_deal = true`) — a deal being worked on internally before going to market
- A **marketplace listing** (`is_internal_deal = false`) — published to the buyer-facing marketplace

Key columns: `title`, `revenue`, `ebitda`, `industry`, `location`, `status`, `source_deal_id`, `is_internal_deal`.

### `deal_pipeline` (buyer pipeline entries)

Each row represents a **buyer pursuing a listing**. This is the CRM pipeline — tracking a specific buyer's progress through deal stages (New Inquiry → Qualified → LOI → Closed).

Key columns: `listing_id` (FK → listings), `stage_id` (FK → deal_stages), `connection_request_id`, `buyer_contact_id` (FK → contacts), `seller_contact_id` (FK → contacts), `value`, `probability`, `source`.

> **Naming note**: This table was renamed from `deals` to `deal_pipeline` in migration `20260506000000` to eliminate confusion with "deals" in the listings table. The word "deal" in `deal_pipeline` refers to a buyer's pursuit, not the company being sold.

### `deal_stages`

Pipeline stage definitions (New Inquiry, Qualified, LOI, Due Diligence, Closed Won, etc.). Referenced by `deal_pipeline.stage_id`.

### `connection_requests`

Buyer inquiries/expressions of interest. When a buyer connects with a listing, a `connection_request` is created and (depending on configuration) a `deal_pipeline` entry is auto-created via trigger.

Lead contact info lives here: `lead_name`, `lead_email`, `lead_company`, `lead_phone`, `lead_role`.

### `contacts`

Normalized contact records for both buyers (`contact_type = 'buyer'`) and sellers (`contact_type = 'seller'`). Referenced by `deal_pipeline.buyer_contact_id` and `deal_pipeline.seller_contact_id`.

### `marketplace_listings` (materialized view)

A view over `listings` filtered to `is_internal_deal = false`. Used for the public marketplace. This is NOT a separate table with duplicated data.

---

## The source_deal_id Pattern

```
listings
  ├── id (PK)
  ├── source_deal_id (FK → listings.id, self-referential)
  └── is_internal_deal (boolean)
```

### How it works

- `source_deal_id` is a **self-referential FK** on the `listings` table
- It was designed to link a marketplace listing back to its originating internal deal
- **Current behavior**: The `publish-listing` edge function simply flips `is_internal_deal` on the SAME row — it does NOT create a child row. Therefore `source_deal_id` is effectively unused for new data.
- **Legacy data**: Some older rows may have `source_deal_id` set from a previous workflow that DID copy rows.

### Rules

1. Do NOT rely on `source_deal_id` for any new business logic
2. Do NOT drop it yet — it still has a FK constraint and may have legacy data
3. New marketplace publishing = flip `is_internal_deal` on the same row

---

## Column Ownership Rules

### Buyer contact info

| Data | Source of Truth | NOT stored on |
|------|----------------|---------------|
| Buyer name | `connection_requests.lead_name` or `contacts.first_name/last_name` | ~~`deal_pipeline.contact_name`~~ (dropped) |
| Buyer email | `connection_requests.lead_email` or `contacts.email` | ~~`deal_pipeline.contact_email`~~ (dropped) |
| Buyer company | `connection_requests.lead_company` or `remarketing_buyers.company_name` | ~~`deal_pipeline.contact_company`~~ (dropped) |
| Buyer phone | `connection_requests.lead_phone` or `contacts.phone` | ~~`deal_pipeline.contact_phone`~~ (dropped) |
| Buyer role | `connection_requests.lead_role` or `contacts.title` | ~~`deal_pipeline.contact_role`~~ (dropped) |

### Seller/company contact info

| Data | Source of Truth |
|------|----------------|
| Seller contact | `contacts` table via `deal_pipeline.seller_contact_id` FK |
| Company main contact | `listings.main_contact_name`, `listings.main_contact_email`, etc. |

### Company address

| Data | Source of Truth |
|------|----------------|
| Company address | `listings.location`, `listings.address_city/state/zip` |
| ~~deal_pipeline.company_address~~ | Dropped — was never written to |

---

## Contact Data Flow

```
Buyer visits marketplace
  └─► Creates connection_request
        ├── lead_name, lead_email, lead_company, etc.
        └─► Trigger creates deal_pipeline entry
              ├── connection_request_id (FK back to CR)
              ├── buyer_contact_id (FK to contacts, if buyer has profile)
              └── seller_contact_id (FK to contacts, if listing has primary seller)

RPCs (get_deals_with_details, get_deals_with_buyer_profiles):
  └─► JOIN connection_requests + contacts to derive contact_name, contact_email, etc.
  └─► Return columns named contact_name/email for backward-compat with frontend
```

---

## Schema Cleanup History

### Migration 20260506000000: Rename deals → deal_pipeline
- Renamed `public.deals` to `public.deal_pipeline`
- Recreated 12 database functions and 6 triggers
- Updated RLS policies
- All frontend `.from('deals')` → `.from('deal_pipeline')`

### Migration 20260506100000: Migrate deal contact fields (data preservation)
- Logged mismatches between `deal_pipeline.contact_*` and `connection_requests.lead_*`
- Created contact records for orphaned deals (no connection_request, no buyer_contact)
- Linked new contacts via `buyer_contact_id`

### Migration 20260506200000: Drop duplicate contact columns
- Dropped: `contact_name`, `contact_email`, `contact_company`, `contact_phone`, `contact_role`, `contact_title`, `company_address`
- Rewrote trigger functions to stop inserting these columns
- Rewrote `get_deals_with_details()` to source contact info from JOINs

### Migration 20260506300000: Drop dead listings columns
- Dropped: `seller_interest_analyzed_at`, `seller_interest_notes`, `lead_source_id`, `manual_rank_set_at`
- These had zero frontend/backend references

### Columns NOT dropped (still alive)
- `listings.status_label` — used in AI command center (deal-tools.ts)
- `listings.industry_tier_name` — used in AI command center (deal-tools.ts)
