# Database Schema Reference

## Overview

PostgreSQL 15 via Supabase. All tables use Row Level Security (RLS). Migrations in `supabase/migrations/`.

## Core Tables

### profiles
Extended user profiles (linked to `auth.users`).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | References auth.users(id) |
| email | TEXT | |
| first_name | TEXT | |
| last_name | TEXT | |
| company | TEXT | |
| company_name | TEXT | |
| buyer_type | TEXT | individual_buyer, pe_firm, family_office, etc. |
| approval_status | TEXT | pending, approved, rejected |
| is_admin | BOOLEAN | |
| business_categories | TEXT[] | Target industries |
| target_locations | TEXT[] | |
| revenue_range_min | NUMERIC | |
| revenue_range_max | NUMERIC | |

**RLS**: Users see own profile; admins see all.

### listings
Deal/transaction listings (170+ columns).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| title | TEXT | Public title |
| internal_company_name | TEXT | Admin-only |
| category | TEXT | |
| categories | TEXT[] | Multiple categories |
| revenue | NUMERIC | In millions |
| ebitda | NUMERIC | In millions |
| location | TEXT | |
| address_state | TEXT | |
| description_html | TEXT | Rich text |
| status | TEXT | active, inactive |
| is_internal_deal | BOOLEAN | |
| primary_owner_id | UUID | Admin owner |

**RLS**: Admins see all; approved buyers see active, non-internal deals.

### connection_requests
Buyer requests to connect with deals.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| listing_id | UUID FK | |
| user_id | UUID FK | Nullable (for leads) |
| status | TEXT | pending, approved, rejected |
| source | TEXT | marketplace, webflow, manual, import, API, website, referral |
| lead_email | TEXT | For non-registered buyers |
| nda_signed | BOOLEAN | |
| fee_agreement_signed | BOOLEAN | |

### remarketing_buyers
External buyer profiles for outbound remarketing.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_name | TEXT | |
| pe_firm_name | TEXT | |
| company_website | TEXT | |
| email_domain | TEXT | |
| hq_city | TEXT | |
| hq_state | TEXT | |
| target_revenue_min | NUMERIC | |
| target_revenue_max | NUMERIC | |
| target_geographies | TEXT[] | |
| target_services | TEXT[] | |

### remarketing_scores
Composite buyer-deal match scores.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| buyer_id | UUID FK | |
| listing_id | UUID FK | |
| composite_score | NUMERIC | 0-100 |
| geography_score | NUMERIC | |
| size_score | NUMERIC | |
| service_score | NUMERIC | |
| tier | TEXT | A, B, C, D, F |
| status | TEXT | pending, approved, passed, hidden |

## Data Room Tables (Feb 2026)

### data_room_documents
Per-deal document storage.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| deal_id | UUID FK → listings | |
| folder_name | TEXT | |
| file_name | TEXT | |
| storage_path | TEXT | Path in Supabase Storage |
| document_category | TEXT | anonymous_teaser, full_memo, data_room |
| allow_download | BOOLEAN | |

### data_room_access
3-toggle buyer access matrix.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| deal_id | UUID FK | |
| remarketing_buyer_id | UUID FK | Exactly one of these two |
| marketplace_user_id | UUID FK | must be non-NULL |
| can_view_teaser | BOOLEAN | |
| can_view_full_memo | BOOLEAN | |
| can_view_data_room | BOOLEAN | |
| fee_agreement_override | BOOLEAN | |
| revoked_at | TIMESTAMPTZ | Soft-revoke |
| expires_at | TIMESTAMPTZ | Optional expiration |

### data_room_audit_log
Complete audit trail.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| deal_id | UUID | |
| document_id | UUID | |
| user_id | UUID | |
| action | TEXT | view_document, download_document, grant_*, revoke_*, etc. |
| metadata | JSONB | |
| ip_address | INET | |

### lead_memos
AI-generated deal memos.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| deal_id | UUID FK | |
| memo_type | TEXT | anonymous_teaser, full_memo |
| content | JSONB | Structured sections |
| html_content | TEXT | Rich text |
| status | TEXT | draft, published, archived |
| version | INTEGER | Auto-incremented |

### memo_distribution_log
Tracks memo sends.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| deal_id | UUID FK | |
| memo_id | UUID FK | |
| channel | TEXT | platform, email, manual_log |

### lead_memo_versions
Version history for memos.

## Key RPCs

| Function | Purpose |
|----------|---------|
| `is_admin(user_id)` | Check admin role |
| `check_data_room_access(deal_id, user_id, category)` | Check buyer access |
| `log_data_room_event(...)` | Insert audit entry |
| `get_deal_access_matrix(deal_id)` | Admin: buyer access summary |
| `get_deal_distribution_log(deal_id)` | Distribution history |
| `get_buyer_deal_history(buyer_id)` | All deals for a buyer |

## Other Tables

| Table | Purpose |
|-------|---------|
| categories | Dynamic category management |
| remarketing_universes | Buyer universe definitions |
| remarketing_buyer_contacts | Contact persons for buyers |
| deals | Pipeline tracking (listing ↔ buyer) |
| deal_stages | Customizable pipeline stages |
| firm_agreements | Fee agreement tracking |
| password_reset_tokens | Secure reset tokens |
| audit_logs | Profile/data change audit trail |
| user_activity | Action tracking for analytics |
| user_journeys | Cross-domain attribution |
| global_activity_queue | Background job tracking |
