# Changes Since 2026-04-08 — Replay Inventory

_Generated for sync into `connect-market-nexus` via Claude Code._

## 1. Executive Summary

- **Date range:** 2026-04-08 → 2026-04-20
- **Migrations:** 189
- **Total edge functions in repo:** 233
- **Edge functions NOT in baseline doc (likely new or undocumented):** 221
- **Audit/report/changelog docs:** 90

## 2. Database Migrations (by week)

### Week of 2026-04-06 — 13 migrations

#### `20260408133611_9fd44dbe-3b59-493e-8d12-8ba4ef89d41a.sql`

- **Date:** 2026-04-08 | **Size:** 0.1KB

#### `20260408133805_8eef0441-05ba-4c94-b7a6-11ea219d99ca.sql`

- **Date:** 2026-04-08 | **Size:** 0.1KB

#### `20260408140754_e905b07c-7534-444f-af59-15656cefa199.sql` ⚠️ DROP

- **Date:** 2026-04-08 | **Size:** 1.9KB
- **Functions/RPCs:** public.protect_sensitive_profile_fields, public.sync_user_verification_status
- **Triggers:** on_auth_user_updated, on_auth_user_verification_inserted
- **DROPS:** TRIGGER:on_auth_user_updated, TRIGGER:on_auth_user_verification_inserted

#### `20260408155754_dfdb4f94-5b1b-42aa-9b3d-b73dfcd0435e.sql`

- **Date:** 2026-04-08 | **Size:** 0.3KB
- **Purpose:** Add webflow_slug column to listings for mapping Webflow deal memo pages
- **Tables altered:** public.listings

#### `20260408161339_1e8dc6d2-f807-4055-b16e-6ea3ed515df3.sql` ⚠️ DROP

- **Date:** 2026-04-08 | **Size:** 5.1KB
- **Purpose:** Split sync_connection_request_firm into BEFORE (set firm_id) and AFTER (insert firm_members) The BEFORE trigger was trying to insert into firm_members with NEW.id which doesn't exist yet Drop the existing combined trigger
- **Functions/RPCs:** sync_connection_request_firm_after, sync_connection_request_firm_before
- **Triggers:** sync_connection_request_firm_after_trigger, sync_connection_request_firm_before_trigger
- **DROPS:** TRIGGER:sync_connection_request_firm_trigger, FUNCTION:sync_connection_request_firm

#### `20260408161412_5fbee3f1-7ea7-43d0-bc9c-96c73c5fffa2.sql`

- **Date:** 2026-04-08 | **Size:** 0.1KB
- **Tables altered:** public.connection_requests

#### `20260408161603_b0242544-126e-4e03-8777-1d10faa84a07.sql`

- **Date:** 2026-04-08 | **Size:** 0.7KB
- **Functions/RPCs:** notify_user_on_connection_request

#### `20260408161639_46ec87c8-ae1f-4d04-a0ff-13a2c6465335.sql`

- **Date:** 2026-04-08 | **Size:** 0.3KB

#### `20260408162449_5d9c4e8d-8273-40fa-a601-f8c8f4a597d1.sql`

- **Date:** 2026-04-08 | **Size:** 0.4KB

#### `20260408162523_858622ba-4166-4592-bff4-2b67d861903a.sql`

- **Date:** 2026-04-08 | **Size:** 0.2KB

#### `20260408171257_a632ddd0-58e5-4793-ae42-1e5077d892b9.sql`

- **Date:** 2026-04-08 | **Size:** 4.1KB

#### `20260408181537_0a89bcf7-903b-4fb2-85e5-4d802dc300d4.sql`

- **Date:** 2026-04-08 | **Size:** 0.7KB
- **Purpose:** Add marketplace_queue_rank column to listings
- **Tables altered:** public.listings
- **Functions/RPCs:** public.bulk_update_connection_request_status

#### `20260408200000_add_marketplace_queue_rank.sql`

- **Date:** 2026-04-08 | **Size:** 0.6KB
- **Purpose:** Migration: Add marketplace_queue_rank to listings Date: 2026-04-08 Purpose: Allow drag-to-reorder ranking of deals in the Marketplace Queue, separate from the Active Deals manual_rank_override.
- **Tables altered:** listings

### Week of 2026-04-13 — 68 migrations

#### `20260413145741_d1722f5e-5640-433c-9311-1cb073f1e6e8.sql`

- **Date:** 2026-04-13 | **Size:** 2.7KB

#### `20260413150424_a69bf6df-0b01-4611-9838-0a223c297641.sql`

- **Date:** 2026-04-13 | **Size:** 6.8KB
- **Purpose:** Step 1: Merge duplicate non-generic email domain firms
- **Functions/RPCs:** public.sync_connection_request_firm_before

#### `20260413151207_38536477-092d-4325-af21-c2731e086396.sql` ⚠️ DROP

- **Date:** 2026-04-13 | **Size:** 4.3KB
- **Purpose:** Drop both overloads of update_fee_agreement_firm_status first
- **Functions/RPCs:** public.update_fee_agreement_firm_status, public.update_lead_fee_agreement_status
- **DROPS:** FUNCTION:public.update_fee_agreement_firm_status, FUNCTION:public.update_fee_agreement_firm_status, FUNCTION:public.update_lead_fee_agreement_status, FUNCTION:public.update_lead_fee_agreement_status

#### `20260413153648_0e7f9bff-3e18-4763-8ba0-bdcbc04d2ca5.sql`

- **Date:** 2026-04-13 | **Size:** 0.4KB
- **Purpose:** Add columns for tracking the auto-sent combined agreement email on leads
- **Tables altered:** public.connection_requests

#### `20260413170613_571acdbe-0ded-4e5c-a240-c3794d59bec6.sql`

- **Date:** 2026-04-13 | **Size:** 1.2KB
- **Purpose:** Reset connection_requests tracking fields for Adam Haile

#### `20260413183853_18e549ec-01a0-4811-995c-6053e56801f5.sql`

- **Date:** 2026-04-13 | **Size:** 4.0KB
- **Purpose:** Fix: update_fee_agreement_firm_status (text overload)
- **Functions/RPCs:** public.update_fee_agreement_firm_status, public.update_lead_fee_agreement_status

#### `20260413185412_699f01d1-8ad4-412c-aea7-6ea8ef1a7ba6.sql`

- **Date:** 2026-04-13 | **Size:** 6.3KB
- **Purpose:** Fix update_lead_nda_status: deals → deal_pipeline
- **Functions/RPCs:** public.update_lead_fee_agreement_status, public.update_lead_nda_status, public.update_nda_firm_status

#### `20260413201553_b19fbac1-c55d-48a0-8a3c-758acfed2830.sql`

- **Date:** 2026-04-13 | **Size:** 0.1KB

#### `20260413202035_8e9a1573-4ee8-4c10-aa6a-5d1ef73ce483.sql`

- **Date:** 2026-04-13 | **Size:** 0.1KB

#### `20260413203730_ab925ae7-de07-4c37-bca4-36def2af4b54.sql`

- **Date:** 2026-04-13 | **Size:** 0.1KB
- **Tables altered:** public.profiles

#### `20260414042802_8d978b27-ab73-4efe-94c4-e722c62b15f2.sql`

- **Date:** 2026-04-14 | **Size:** 0.9KB
- **Purpose:** Add backfill progress tracking columns to email_connections
- **Tables altered:** public.email_connections

#### `20260414110434_7b232025-1405-4d9f-a861-eccc21be8af2.sql`

- **Date:** 2026-04-14 | **Size:** 4.5KB
- **Functions/RPCs:** public.merge_valuation_lead

#### `20260414112931_0076bdcc-0d22-4551-8534-2a6061be3139.sql`

- **Date:** 2026-04-14 | **Size:** 8.8KB
- **Purpose:** ═══ 1. Add new columns ═══
- **Tables altered:** public.valuation_leads
- **Functions/RPCs:** public.merge_valuation_lead

#### `20260414131051_e609ac4d-eed1-4fa4-ba92-c49f34dd1990.sql`

- **Date:** 2026-04-14 | **Size:** 1.4KB

#### `20260414133733_c29f927a-0e54-4588-8d4b-5d91bef9afb3.sql`

- **Date:** 2026-04-14 | **Size:** 0.6KB
- **Purpose:** Backfill Aftercare Restoration deal row

#### `20260414174925_3f6e85d4-944a-4b59-ae63-aff1b711fdc7.sql`

- **Date:** 2026-04-14 | **Size:** 0.8KB
- **Functions/RPCs:** public.get_lead_agreement_tracking

#### `20260414180048_068d6394-295e-479e-a7c7-97c206d5f68c.sql`

- **Date:** 2026-04-14 | **Size:** 0.3KB

#### `20260415100354_658edd74-ff2b-4f08-b2a8-cb55ca11eeff.sql`

- **Date:** 2026-04-15 | **Size:** 3.0KB
- **Purpose:** Fix: guard against NULL user_id for external leads (no registered user)
- **Functions/RPCs:** public.notify_user_on_admin_comment, public.notify_user_on_stage_change, public.notify_user_on_status_change

#### `20260415103619_5e3c4a21-c610-43c4-a4aa-26eb24b5908a.sql`

- **Date:** 2026-04-15 | **Size:** 0.4KB

#### `20260415105753_a5358b07-948d-441b-9f2d-b6a13f4768db.sql`

- **Date:** 2026-04-15 | **Size:** 1.7KB

#### `20260415111113_14a24c7f-522d-495f-98a0-f7ccf03b7f63.sql`

- **Date:** 2026-04-15 | **Size:** 4.8KB

#### `20260415111700_5819c48a-7367-419d-878e-72ead730b21a.sql`

- **Date:** 2026-04-15 | **Size:** 0.3KB
- **Purpose:** Update Case 6: Fee signed, NDA not → already_covered (Fee Agreement alone is sufficient)

#### `20260415115233_f9da0fcf-474c-4523-8569-67353c95772c.sql`

- **Date:** 2026-04-15 | **Size:** 1.6KB
- **Purpose:** Delete firm_members referencing test connection requests

#### `20260415121817_4f6f8c8e-d782-4e60-9273-258df6dab0c9.sql`

- **Date:** 2026-04-15 | **Size:** 0.4KB
- **Purpose:** First delete the firm_member referencing the test connection request

#### `20260415125856_d1001ca1-5117-4f7a-aaa7-58e4af8f5b98.sql`

- **Date:** 2026-04-15 | **Size:** 1.0KB
- **Purpose:** Backfill UTM params from raw_payload pageUrl into top-level source_metadata fields

#### `20260415125929_1bc5ac24-7bd2-4db1-b895-8f5a652746ea.sql`

- **Date:** 2026-04-15 | **Size:** 0.2KB

#### `20260415131348_3575528e-7e18-49c7-9a6c-8698dce9b2ed.sql`

- **Date:** 2026-04-15 | **Size:** 0.6KB
- **Purpose:** Delete dependent firm_members referencing test connection requests

#### `20260415143007_fe15ddd4-eb84-46e7-9435-d70128e9bbf3.sql`

- **Date:** 2026-04-15 | **Size:** 2.8KB
- **Purpose:** Fix update_lead_fee_agreement_status to also sync connection_requests
- **Functions/RPCs:** public.update_lead_fee_agreement_status, public.update_lead_nda_status

#### `20260415173912_84f99688-3adf-4f84-9bf3-7dc1420ea0af.sql` ⚠️ DROP

- **Date:** 2026-04-15 | **Size:** 4.9KB
- **Purpose:** Helper: map firm_agreements status → deal_pipeline status
- **Functions/RPCs:** public.map_agreement_status_to_deal, public.sync_firm_agreement_to_downstream
- **Triggers:** trg_sync_firm_agreement_downstream
- **DROPS:** TRIGGER:trg_sync_firm_agreement_downstream

#### `20260415181114_507bda72-d174-42c3-b741-4a58fe910aa4.sql`

- **Date:** 2026-04-15 | **Size:** 16.2KB
- **Purpose:** 1) Harden auto_link_user_to_firm: wrap entire body in exception handler
- **Functions/RPCs:** public.auto_link_user_to_firm, public.link_lead_requests_on_signup, public.sync_marketplace_buyer_on_signup

#### `20260415181712_4de4d1c4-921e-4211-a051-4ecb0551dace.sql`

- **Date:** 2026-04-15 | **Size:** 16.0KB
- **Functions/RPCs:** public.handle_new_user

#### `20260415183855_3f96ff13-b962-4250-ac74-da3dd5070c25.sql`

- **Date:** 2026-04-15 | **Size:** 18.5KB
- **Functions/RPCs:** public.handle_new_user

#### `20260415184758_591fbd44-c465-499a-af5b-294557bbf0a5.sql`

- **Date:** 2026-04-15 | **Size:** 7.1KB
- **Purpose:** 1. Create the minimal profile repair RPC
- **Functions/RPCs:** public.ensure_profile_exists, public.handle_new_user

#### `20260415190042_261059ea-e99b-4307-974e-6672be39b2b1.sql`

- **Date:** 2026-04-15 | **Size:** 7.1KB
- **Purpose:** Rewrite handle_new_user with correct schema alignment
- **Functions/RPCs:** public.ensure_profile_exists, public.handle_new_user

#### `20260415190804_35eb2af1-bebf-41ed-84e0-85080ffb3ec1.sql`

- **Date:** 2026-04-15 | **Size:** 12.0KB
- **Purpose:** 1. Create hydrate_profile_from_metadata RPC This reads raw_user_meta_data from auth.users and writes to profiles SECURITY DEFINER so it works even without a valid session (pre-verification)
- **Functions/RPCs:** public.ensure_profile_exists, public.handle_new_user, public.hydrate_profile_from_metadata

#### `20260415191330_ff57e3cc-d174-485e-9fc0-3b8162bef04a.sql`

- **Date:** 2026-04-15 | **Size:** 12.2KB
- **Purpose:** 1. Create save_extended_profile RPC (SECURITY DEFINER) Accepts a user_id + jsonb payload and writes extended profile fields. Bypasses RLS so it works pre-verification.
- **Functions/RPCs:** public.handle_new_user, public.save_extended_profile

#### `20260415191813_8946da3d-6906-4fad-8f20-de4487f8eec1.sql`

- **Date:** 2026-04-15 | **Size:** 6.2KB
- **Functions/RPCs:** public.save_extended_profile

#### `20260415192319_2c4481a9-bca5-4e53-936c-a53a66b5b016.sql`

- **Date:** 2026-04-15 | **Size:** 5.7KB
- **Functions/RPCs:** public.save_extended_profile

#### `20260415192728_c3bf249d-d0d5-4e61-8bfd-4cf524443976.sql`

- **Date:** 2026-04-15 | **Size:** 5.3KB
- **Functions/RPCs:** public.save_extended_profile

#### `20260415213331_6db139ee-d3a9-440c-807e-6586dbf7beeb.sql`

- **Date:** 2026-04-15 | **Size:** 2.6KB

#### `20260415214030_f688f986-8a48-481c-9707-6f0357dfd8ea.sql`

- **Date:** 2026-04-15 | **Size:** 0.3KB
- **Purpose:** Clear firm_members references to bogus CRs first

#### `20260415215502_5bf86810-b7f5-448e-a04f-c4ac1b4f1082.sql`

- **Date:** 2026-04-15 | **Size:** 2.0KB
- **Purpose:** Insert 3 missing Webflow leads with firm_id pre-populated to avoid trigger conflict

#### `20260416095716_6a776bc7-0a2a-4dd7-b6a6-43a37f147b5c.sql`

- **Date:** 2026-04-16 | **Size:** 0.8KB
- **Purpose:** Backfill ideal_target_description from buyers.thesis_summary

#### `20260416105923_0ccb09e7-1b22-4c52-9a08-b8b484507fd3.sql`

- **Date:** 2026-04-16 | **Size:** 1.3KB
- **Purpose:** Create invite_links table for admin-generated pre-approval tokens
- **Tables created:** public.invite_links
- **Tables altered:** public.invite_links
- **RLS policies created:** 3

#### `20260416115522_01d83e73-24df-4d7a-ace3-655e657eef67.sql` ⚠️ DROP

- **Date:** 2026-04-16 | **Size:** 0.7KB
- **Purpose:** Drop the two older overloads (24-param and 26-param), keeping only the complete 43-param version 1) Drop the original 24-param version
- **DROPS:** FUNCTION:public.merge_valuation_lead, FUNCTION:public.merge_valuation_lead

#### `20260416120456_131e5208-1720-4145-b4f6-e677287563d4.sql` ⚠️ DROP

- **Date:** 2026-04-16 | **Size:** 8.5KB
- **Purpose:** 1. Add raw_body column to incoming_leads
- **Tables altered:** public.incoming_leads
- **Functions/RPCs:** public.merge_valuation_lead
- **DROPS:** FUNCTION:public.merge_valuation_lead

#### `20260416120607_ab4110db-aa60-4c35-bde9-c69acce08ea8.sql`

- **Date:** 2026-04-16 | **Size:** 0.3KB
- **Purpose:** Backfill readiness_score from raw_valuation_results for leads that have it

#### `20260416121800_9b614ff9-4307-435f-a8cb-b4b8d08d8cbd.sql`

- **Date:** 2026-04-16 | **Size:** 3.3KB
- **Purpose:** Backfill auto_shop leads: extract structured fields from raw JSONB Only fills in NULL/empty values to preserve any data already set

#### `20260416134010_4b3e14a5-75b4-4628-9180-f9b19ae17bac.sql`

- **Date:** 2026-04-16 | **Size:** 1.9KB
- **Purpose:** Step 1: Copy useful flags from excluded initial_import duplicates to the new valuation_calculator records

#### `20260416135347_e77e597a-bb1e-4eab-8ef1-01fa7b585765.sql`

- **Date:** 2026-04-16 | **Size:** 3.1KB
- **Purpose:** Backfill all JSONB sections from incoming_leads raw_body into valuation_leads This fixes the COALESCE issue where empty {} objects blocked new data

#### `20260416140045_9db6d984-5f46-40e3-aa2f-bd47b6d7baf1.sql`

- **Date:** 2026-04-16 | **Size:** 0.4KB
- **Purpose:** Delete test submissions

#### `20260416140823_9d7f4163-bc89-4588-a4c3-93b3e860216f.sql`

- **Date:** 2026-04-16 | **Size:** 12.7KB
- **Purpose:** Fix created_at for backfilled valuation_calculator leads to their original submission dates

#### `20260416141818_00611dfb-0185-409d-92e1-6a24d83fff2b.sql`

- **Date:** 2026-04-16 | **Size:** 1.3KB
- **Purpose:** Fix created_at timestamps for 7 backfilled valuation_calculator leads These were ingested on 2026-04-16 but have original submission dates from the CSV

#### `20260416142324_9f73115f-7cbd-4de4-aa84-de6eba183a25.sql`

- **Date:** 2026-04-16 | **Size:** 1.0KB
- **Purpose:** Fix revenue_model for 3 backfilled leads from CSV data

#### `20260416143729_f48f6980-64fb-4d0b-92de-4612588d718b.sql`

- **Date:** 2026-04-16 | **Size:** 14.7KB

#### `20260416144329_726c7a95-1668-4c42-a1bb-e14f621f7099.sql`

- **Date:** 2026-04-16 | **Size:** 4.9KB

#### `20260416165043_5c90a699-b920-4849-ad83-9d9512955be1.sql`

- **Date:** 2026-04-16 | **Size:** 0.2KB
- **Tables altered:** public.valuation_leads

#### `20260416184716_25da87fa-dbca-4601-902b-e5f5b084b4ba.sql`

- **Date:** 2026-04-16 | **Size:** 0.5KB
- **Functions/RPCs:** public.create_listing_conversation

#### `20260416200704_05590287-5653-4c9a-8478-d7d306fe009f.sql`

- **Date:** 2026-04-16 | **Size:** 1.0KB
- **Purpose:** Step A: Clear the slug from the internal/private listing so the public one can claim it (unique constraint on listings.webflow_slug requires moving, not duplicating)

#### `20260417104501_21a0b9c9-78ff-4925-92c9-71b2d0a04784.sql`

- **Date:** 2026-04-17 | **Size:** 0.1KB
- **Tables altered:** public.valuation_leads

#### `20260417105824_d1cc59ae-51e2-4a27-a7b7-8deaa41b9c84.sql` ⚠️ DROP

- **Date:** 2026-04-17 | **Size:** 1.4KB
- **Purpose:** Bulk-run status table for backfill-valuation-lead-contacts
- **Tables created:** public.contact_backfill_runs
- **Tables altered:** public.contact_backfill_runs
- **RLS policies created:** 1
- **DROPS:** POLICY:"Admins

#### `20260417112255_b50403e4-09cc-4834-a585-aa4d54a6fe54.sql` ⚠️ DROP

- **Date:** 2026-04-17 | **Size:** 1.7KB
- **Purpose:** Mark the stuck run as failed so it doesn't block anything
- **Tables created:** public.contact_backfill_queue
- **Tables altered:** public.contact_backfill_queue, public.contact_backfill_runs
- **RLS policies created:** 1
- **DROPS:** POLICY:"Admins

#### `20260417123534_ecc9b6eb-5a00-4b02-b3e1-425c33bd7141.sql` ⚠️ DROP

- **Date:** 2026-04-17 | **Size:** 1.5KB
- **Purpose:** Align RLS read access on contact backfill tables with is_admin() so owner, admin, and moderator roles can all see live progress.
- **Tables altered:** public.contact_backfill_queue, public.contact_backfill_runs
- **RLS policies created:** 2
- **DROPS:** POLICY:"Admins, POLICY:"Admins

#### `20260417131240_d1047c68-bae5-4028-8de7-4a6939c82ce0.sql`

- **Date:** 2026-04-17 | **Size:** 0.7KB
- **Purpose:** Add valuation_lead_id attribution column to contact_activities
- **Tables altered:** public.contact_activities

#### `20260417132755_f721aef1-13df-4f7a-9ace-dcb49205f77f.sql`

- **Date:** 2026-04-17 | **Size:** 0.1KB
- **Tables altered:** public.contact_activities

#### `20260417145909_83f3aecc-a945-47d2-99b7-ac50a9e9998e.sql` ⚠️ DROP

- **Date:** 2026-04-17 | **Size:** 5.5KB
- **Purpose:** ───────────────────────────────────────────────────────────── 1) Validation function: returns reason string or NULL if clean ─────────────────────────────────────────────────────────────
- **Functions/RPCs:** public.quarantine_invalid_valuation_lead, public.valuation_lead_quarantine_reason
- **Triggers:** trg_quarantine_invalid_valuation_lead
- **DROPS:** TRIGGER:trg_quarantine_invalid_valuation_lead

#### `20260417152744_284092f8-eb27-4da3-9da4-bc07830d0c3f.sql`

- **Date:** 2026-04-17 | **Size:** 1.5KB
- **Purpose:** Add outreach email tracking columns to valuation_leads
- **Tables altered:** public.valuation_leads
- **Functions/RPCs:** public.get_valuation_lead_outreach_tracking

#### `20260417163417_0d86ad48-4abb-449d-a357-2bd6de2a86ef.sql`

- **Date:** 2026-04-17 | **Size:** 5.6KB
- **Purpose:** Data update: Agellus Capital + 4 platform companies + Dominic Lupo profile 1) Update Agellus PE firm record (firm-wide truth only)

### Week of 2026-04-20 — 6 migrations

#### `20260420111238_355660ef-9c1a-4a33-bc5b-21203e89fe69.sql` ⚠️ DROP

- **Date:** 2026-04-20 | **Size:** 2.7KB
- **Purpose:** Add parity columns to match_tool_leads
- **Tables altered:** public.match_tool_leads
- **Functions/RPCs:** public.match_tool_leads_auto_quarantine
- **Triggers:** trg_match_tool_leads_auto_quarantine
- **DROPS:** TRIGGER:trg_match_tool_leads_auto_quarantine

#### `20260420113733_33fd0574-eede-4416-9d7f-df328ab4153e.sql`

- **Date:** 2026-04-20 | **Size:** 0.3KB
- **Tables altered:** public.match_tool_leads

#### `20260420114604_f960e530-92bc-45dc-8d07-6b74b357ef82.sql`

- **Date:** 2026-04-20 | **Size:** 4.0KB
- **Purpose:** Extend auto-quarantine trigger with noise-domain list
- **Functions/RPCs:** public.match_tool_leads_auto_quarantine

#### `20260420114854_834f6847-223c-46ac-8ebb-8f40b3620c05.sql` ⚠️ DROP

- **Date:** 2026-04-20 | **Size:** 2.0KB
- **Purpose:** Make the auto-quarantine trigger fire on UPDATE too, so future edits get re-validated
- **Triggers:** trg_match_tool_leads_auto_quarantine
- **DROPS:** TRIGGER:trg_match_tool_leads_auto_quarantine

#### `20260420130403_412c2369-375b-4fed-bd54-efe630dd51bc.sql`

- **Date:** 2026-04-20 | **Size:** 0.6KB
- **Tables altered:** public.match_tool_leads

#### `20260420135245_3f5c2b21-fb5f-418e-ace7-a607e0309cd5.sql`

- **Date:** 2026-04-20 | **Size:** 0.9KB
- **Functions/RPCs:** public.get_match_tool_lead_outreach_tracking

### Week of 2026-04-27 — 9 migrations

#### `20260501000000_buyer_recommendation_cache.sql`

- **Date:** 2026-05-01 | **Size:** 1.0KB
- **Purpose:** Migration A: buyer_recommendation_cache table Stores scored results per deal so the page load is fast on return visits.
- **Tables created:** public.buyer_recommendation_cache
- **Tables altered:** public.buyer_recommendation_cache
- **RLS policies created:** 1

#### `20260501000001_remarketing_buyers_seeding_columns.sql`

- **Date:** 2026-05-01 | **Size:** 0.8KB
- **Purpose:** Migration B: remarketing_buyers seeding columns Adds columns needed to track AI-seeded buyers.
- **Tables altered:** public.remarketing_buyers

#### `20260501000002_buyer_seed_log.sql`

- **Date:** 2026-05-01 | **Size:** 0.8KB
- **Purpose:** Migration C: buyer_seed_log table Audit trail for the AI buyer seeding engine.
- **Tables created:** public.buyer_seed_log
- **Tables altered:** public.buyer_seed_log
- **RLS policies created:** 1

#### `20260501000003_buyer_seed_cache.sql`

- **Date:** 2026-05-01 | **Size:** 0.7KB
- **Purpose:** Migration D: buyer_seed_cache table Prevents the seeding engine from calling Claude twice for the same category + deal size + region combination within 90 days.
- **Tables created:** public.buyer_seed_cache
- **Tables altered:** public.buyer_seed_cache
- **RLS policies created:** 1

#### `20260501100000_drop_dead_listing_columns.sql` ⚠️ DROP

- **Date:** 2026-05-01 | **Size:** 0.7KB
- **Purpose:** Drop dead listing columns that are no longer read or written by any application code. These were added for the old generate-listing-content AI pipeline which has been replaced by the lead memo generator (generate-lead-memo). revenue_model_breakdown: Was rendered by EnhancedInvestorDashboard (now del
- **Tables altered:** public.listings
- **DROPS:** COLUMN:revenue_model_breakdown, COLUMN:market_position, COLUMN:transaction_preferences

#### `20260502000000_test_run_tracking.sql` ⚠️ DROP

- **Date:** 2026-05-02 | **Size:** 3.1KB
- **Purpose:** ═══════════════════════════════════════════════════════════════ Migration: test_run_tracking Date: 2026-05-02 Purpose: Creates tables for tracking Testing & Diagnostics runs, so users can see historical results after navigating away. Similar pattern to enrichment_test_runs / enrichment_test_results.
- **Tables created:** test_run_results, test_run_tracking
- **Tables altered:** test_run_results, test_run_tracking
- **RLS policies created:** 2
- **DROPS:** POLICY:test_run_tracking_auth, POLICY:test_run_results_auth

#### `20260502100000_buyer_recommendation_hardening.sql`

- **Date:** 2026-05-02 | **Size:** 2.0KB
- **Purpose:** Hardening migration for buyer recommendation tables. Adds missing indexes, CHECK constraints, and FK comment. 1. Missing index on buyer_seed_log.category_cache_key Speeds up lookups when checking seed history for a given cache key.
- **Tables altered:** public.buyer_recommendation_cache, public.buyer_seed_log

#### `20260503000000_drop_unused_tables.sql` ⚠️ DROP

- **Date:** 2026-05-03 | **Size:** 3.7KB
- **Purpose:** Migration: Drop 31 unused tables identified in codebase audit 2026-03-02 These tables have zero references in any frontend code or edge function. Verified: no INSERT, UPDATE, DELETE, or SELECT operations touch these tables. 1. Exact duplicate table
- **DROPS:** TABLE:marketplace_listings, TABLE:buyer_introductions, TABLE:buyer_introduction_summary, TABLE:introduced_and_passed_buyers, TABLE:not_yet_introduced_buyers, TABLE:introduction_activity

#### `20260503100000_clear_buyer_recommendation_caches.sql`

- **Date:** 2026-05-03 | **Size:** 0.9KB
- **Purpose:** Migration: Clear all buyer recommendation caches Reason: Scoring algorithm was overhauled (synonym expansion, expanded deal fields, AI prompt rebuild, fit_reason construction). All existing cached scores are stale and will produce incorrect results if served from cache. 1. Clear scored buyer results

### Week of 2026-05-04 — 10 migrations

#### `20260504000000_fix_deals_rpc_connection_request_filter.sql` ⚠️ DROP

- **Date:** 2026-05-04 | **Size:** 4.5KB
- **Purpose:** T35 FIX: Stop hiding deals with non-approved connection requests The get_deals_with_buyer_profiles RPC previously filtered with: AND (d.connection_request_id IS NULL OR cr.status = 'approved') This hid deals that had pending or rejected connection requests. The fix changes the WHERE clause to: AND (
- **Functions/RPCs:** public.get_deals_with_buyer_profiles
- **DROPS:** FUNCTION:public.get_deals_with_buyer_profiles

#### `20260505000000_clay_enrichment_requests.sql` ⚠️ DROP

- **Date:** 2026-05-05 | **Size:** 7.1KB
- **Purpose:** Clay Enrichment Requests Tracks outbound webhook requests to Clay and correlates async callbacks. Used by clay-webhook-name-domain and clay-webhook-linkedin edge functions.
- **Tables created:** clay_enrichment_requests
- **Tables altered:** clay_enrichment_requests, listings
- **Functions/RPCs:** sync_deal_financials_to_listings
- **Triggers:** trg_sync_deal_financials
- **RLS policies created:** 2
- **DROPS:** TRIGGER:trg_sync_deal_financials, COLUMN:need_owner_contact

#### `20260506000000_fix_buyer_introductions_rls.sql` ⚠️ DROP

- **Date:** 2026-05-06 | **Size:** 39.9KB
- **Purpose:** Fix RLS policies for buyer_introductions table Allow any authenticated user to INSERT (with their own user ID as created_by) and UPDATE records they created, in addition to the existing admin-all policy. Authenticated users can insert their own introductions
- **Tables altered:** public.deals
- **Functions/RPCs:** public.auto_create_deal_from_connection_request, public.cascade_soft_delete_listing, public.create_deal_from_connection_request, public.create_deal_from_inbound_lead, public.create_deal_on_request_approval, public.delete_listing_cascade, public.get_buyer_deal_history, public.get_deals_with_buyer_profiles …
- **Triggers:** audit_deal_pipeline_trigger, sync_followup_to_connection_requests, trg_deal_stage_change, trg_deal_stage_timestamp, trigger_auto_assign_deal, trigger_notify_deal_reassignment
- **RLS policies created:** 5
- **DROPS:** POLICY:buyer_introductions_authenticated_insert, POLICY:buyer_introductions_creator_update, POLICY:introduction_status_log_authenticated_insert, POLICY:introduction_status_log_creator_select, TRIGGER:update_deal_stage_trigger, TRIGGER:trg_deal_stage_timestamp

#### `20260506100000_migrate_deal_contact_fields.sql`

- **Date:** 2026-05-06 | **Size:** 3.8KB
- **Purpose:** MIGRATION: Migrate deal*pipeline contact fields to contacts table The contact_name, contact_email, contact_company, contact_phone, contact_role, and company_address columns on deal_pipeline store BUYER contact info. This data is redundant with: connection_requests.lead*\* (for marketplace/webflow lea

#### `20260506200000_drop_deal_pipeline_duplicate_columns.sql` ⚠️ DROP

- **Date:** 2026-05-06 | **Size:** 14.2KB
- **Purpose:** MIGRATION: Drop duplicate contact/address columns from deal*pipeline Run AFTER 20260506100000_migrate_deal_contact_fields.sql has been verified in production. These columns are redundant because: Buyer contact info lives on connection_requests (lead*\*) or contacts (via buyer_contact_id FK)
- **Tables altered:** public.deal_pipeline
- **Functions/RPCs:** public.auto_create_deal_from_connection_request, public.create_deal_from_connection_request, public.create_deal_from_inbound_lead, public.create_deal_on_request_approval, public.get_deals_with_details
- **DROPS:** COLUMN:contact_name, COLUMN:contact_email, COLUMN:contact_company, COLUMN:contact_phone, COLUMN:contact_role, COLUMN:contact_title

#### `20260506300000_drop_dead_listings_columns.sql` ⚠️ DROP

- **Date:** 2026-05-06 | **Size:** 0.9KB
- **Purpose:** MIGRATION: Drop confirmed-dead columns from listings These columns have ZERO frontend/backend references (verified by grep audit): seller_interest_analyzed_at: never read or written in app code seller_interest_notes: never read or written in app code lead_source_id: never read or written in app code
- **Tables altered:** public.listings
- **DROPS:** COLUMN:seller_interest_analyzed_at, COLUMN:seller_interest_notes, COLUMN:lead_source_id, COLUMN:manual_rank_set_at

#### `20260507000000_add_score_snapshot_to_buyer_introductions.sql`

- **Date:** 2026-05-07 | **Size:** 0.7KB
- **Purpose:** Migration: 20260507000000_add_score_snapshot_to_buyer_introductions.sql Persist scoring data on buyer introduction records so cards always display fit reason, fit signals, tier, composite score, and source even when the live scoring cache is unavailable.
- **Tables altered:** buyer_introductions

#### `20260508000000_add_deal_task_types.sql`

- **Date:** 2026-05-08 | **Size:** 2.1KB
- **Purpose:** Add deal-specific task types: call, email, find_buyers, contact_buyers Drop existing constraint
- **Tables altered:** listings, public.daily_standup_tasks

#### `20260509000000_update_introduction_status_workflow.sql`

- **Date:** 2026-05-09 | **Size:** 3.4KB
- **Purpose:** Migration: 20260509000000_update_introduction_status_workflow.sql Updates buyer introduction statuses from old workflow to new: Old: not_introduced, introduction_scheduled, introduced, passed, rejected New: outreach_initiated, meeting_scheduled, not_a_fit, fit_and_interested 1. Migrate existing data
- **Tables altered:** buyer_introductions

#### `20260510000000_backfill_pe_firm_ids.sql`

- **Date:** 2026-05-10 | **Size:** 3.1KB
- **Purpose:** Backfill pe_firm_id for platform/strategic/family_office buyers that have pe_firm_name set but no pe_firm_id linked. Strategy: 1. For each distinct pe_firm_name that has orphaned references, check if a remarketing_buyers record with buyer_type='pe_firm' already exists. 2. If no PE firm record exists

### Week of 2026-05-11 — 18 migrations

#### `20260511000000_add_remarketing_buyer_id_to_introductions.sql` ⚠️ DROP

- **Date:** 2026-05-11 | **Size:** 15.7KB
- **Purpose:** Add remarketing_buyer_id column to buyer_introductions so we can track which remarketing_buyers row an introduction originated from, WITHOUT mis-using contact_id (which has FK to contacts). Previously the Accept flow was storing remarketing_buyers.id into contact_id, violating the contacts FK constr
- **Tables altered:** buyer_introductions, public.remarketing_buyers
- **Functions/RPCs:** public.sync_marketplace_buyer_on_approval
- **Triggers:** trg_sync_marketplace_buyer_on_approval
- **DROPS:** TRIGGER:trg_sync_marketplace_buyer_on_approval

#### `20260512000000_buyer_contact_at_signup.sql` ⚠️ DROP

- **Date:** 2026-05-12 | **Size:** 20.7KB
- **Purpose:** BUYER + CONTACT CREATION AT SIGNUP Changes the marketplace sync trigger to fire on profile INSERT (not just approval). This ensures every marketplace user immediately gets: 1. A remarketing_buyers row (their company/org) 2. A contacts row (them as a person) 3. profiles.remarketing_buyer_id linked to
- **Functions/RPCs:** invalidate_buyer_recommendation_cache, public.sync_marketplace_buyer_on_signup
- **Triggers:** invalidate_rec_cache_on_buyer_change, trg_sync_marketplace_buyer_on_signup
- **DROPS:** TRIGGER:trg_sync_marketplace_buyer_on_approval, FUNCTION:public.sync_marketplace_buyer_on_approval, TRIGGER:invalidate_rec_cache_on_buyer_change

#### `20260513000000_add_assignee_rls_policy_standup_tasks.sql` ⚠️ DROP

- **Date:** 2026-05-13 | **Size:** 10.9KB
- **Purpose:** Add RLS policy for task assignees on daily_standup_tasks Previously only admin/owner/moderator roles could read tasks. Non-admin users assigned tasks could not see them at all, causing the "My Tasks" view to be blank for regular users. Allow users to SELECT tasks assigned to them
- **Tables altered:** public.listings, public.remarketing_buyers
- **Functions/RPCs:** public.get_deals_with_buyer_profiles, public.sync_buyer_score_to_remarketing
- **Triggers:** trg_sync_buyer_score
- **RLS policies created:** 3
- **DROPS:** FUNCTION:public.get_deals_with_buyer_profiles, TRIGGER:trg_sync_buyer_score

#### `20260514000000_rename_remarketing_buyers_to_buyers.sql`

- **Date:** 2026-05-14 | **Size:** 3.9KB
- **Purpose:** RENAME remarketing*buyers → buyers The remarketing_buyers table holds ALL buyers (marketplace, imported, AI-seeded, manually created). The "remarketing*" prefix is misleading. Also renames remarketing_buyer_universes → buyer_universes. Creates backward-compatible views so existing queries don't brea
- **Tables altered:** public.remarketing_buyer_universes, public.remarketing_buyers

#### `20260515000000_add_need_to_show_deal_status.sql` ⚠️ DROP

- **Date:** 2026-05-15 | **Size:** 8.0KB
- **Purpose:** Migration: Add 'need_to_show_deal' as the initial introduction status This adds a new first phase before 'outreach_initiated' in the buyer introduction workflow. 1. Drop old constraint and add new one with 'need_to_show_deal'
- **Tables altered:** buyer_introductions, public.listings
- **DROPS:** COLUMN:need_buyer_universe, COLUMN:need_owner_contact, TABLE:public.buyer_deal_scores, TABLE:public.buyer_contacts, POLICY:"Admins, POLICY:"Admins

#### `20260515000001_add_publicly_traded_flag.sql`

- **Date:** 2026-05-15 | **Size:** 0.6KB
- **Purpose:** Migration: Add 'is_publicly_traded' flag to remarketing_buyers and listings Tracks whether a buyer/company is publicly traded. Add to remarketing_buyers (buyer universe companies)
- **Tables altered:** listings, remarketing_buyers

#### `20260515100000_drop_dead_listing_columns.sql` ⚠️ DROP

- **Date:** 2026-05-15 | **Size:** 0.7KB
- **Purpose:** Drop confirmed dead columns from listings table. Evidence for each column being dead: linkedin_headquarters: Written by LinkedIn scraper (Apify), but NEVER read anywhere in frontend or edge function code. Zero display, zero logic references. status_label: Only appeared in auto-generated types. Zero
- **Tables altered:** public.listings
- **DROPS:** COLUMN:linkedin_headquarters, COLUMN:status_label, COLUMN:financial_notes

#### `20260515200000_optimize_active_deals_query.sql`

- **Date:** 2026-05-15 | **Size:** 1.2KB
- **Purpose:** OPTIMIZE ACTIVE DEALS QUERY The Active Deals page query filters on: remarketing_status = 'active' AND deleted_at IS NULL AND (deal_source IN (...) OR (deal_source IN (...) AND pushed_to_all_deals = true)) Then orders by: manual_rank_override ASC NULLS LAST, deal_total_score DESC, created_at DESC The

#### `20260516000000_add_sourceco_to_dashboard_stats.sql`

- **Date:** 2026-05-16 | **Size:** 12.3KB
- **Purpose:** Add 'sourceco' deal source to dashboard stats function Mirrors the same treatment as gp_partners: hidden from active when unpushed, uses push date for "new in period", and has dedicated card metrics.
- **Tables created:** admin_view_state
- **Tables altered:** admin_view_state
- **Functions/RPCs:** public.get_remarketing_dashboard_stats, reset_all_admin_notifications
- **RLS policies created:** 4

#### `20260516100000_global_rate_limiter.sql`

- **Date:** 2026-05-16 | **Size:** 5.0KB
- **Purpose:** Migration: Global API Rate Limiter (Semaphore) Part of: Data Architecture Audit Phase 5 Provides coordinated rate limiting across all enrichment queues to prevent thundering herd problems on external APIs. 1. Rate limits configuration per provider
- **Tables created:** api_rate_limits, api_semaphore
- **Tables altered:** api_rate_limits, api_semaphore
- **Functions/RPCs:** acquire_api_slot, get_api_utilization, release_api_slot
- **RLS policies created:** 4

#### `20260516200000_buyer_single_source_of_truth.sql`

- **Date:** 2026-05-16 | **Size:** 9.8KB
- **Purpose:** BUYER SINGLE-SOURCE-OF-TRUTH FIX — PHASE 1 Problem: Buyer data is scattered across profiles, remarketing_buyers, and contacts with no canonical RPC to join them. Frontend code reads stale copies in profiles (company, buyer_type, deal-size) instead of the authoritative remarketing_buyers record. Thi
- **Functions/RPCs:** public.compute_buyer_priority, public.get_buyer_profile

#### `20260516300000_replace_trigger_chains_with_rpcs.sql` ⚠️ DROP

- **Date:** 2026-05-16 | **Size:** 18.2KB
- **Purpose:** PHASE 4 MIGRATION: Replace trigger chains with explicit RPCs This migration creates two RPC functions that consolidate multi-trigger chains into single, explicit, transactional operations: 1. create_pipeline_deal(p_connection_request_id) Replaces the 4-trigger chain on connection_requests INSERT: tr
- **Functions/RPCs:** public.create_pipeline_deal, public.update_agreement_status
- **DROPS:** TRIGGER:trg_ensure_source_from_lead, TRIGGER:IF, TRIGGER:trg_log_agreement_status_change, TRIGGER:trg_sync_fee_agreement_to_remarketing

#### `20260516400000_event_driven_architecture.sql` ⚠️ DROP

- **Date:** 2026-05-16 | **Size:** 11.2KB
- **Purpose:** Phase 9: Event-Driven Architecture Expands global_activity_queue into a proper event bus with emit/claim/retry semantics. All statements are idempotent (IF NOT EXISTS / CREATE OR REPLACE). Standard Event Types Reference deal.created — A new deal was created deal.stage_changed — D
- **Tables altered:** public.global_activity_queue
- **Functions/RPCs:** public.claim_events, public.emit_event, public.mark_event_failed
- **RLS policies created:** 2
- **DROPS:** POLICY:"Authenticated, POLICY:"Authenticated, POLICY:"Authenticated, POLICY:"Authenticated, POLICY:"Admins, POLICY:"service_role

#### `20260516500000_analytics_consolidation.sql` ⚠️ DROP

- **Date:** 2026-05-16 | **Size:** 7.3KB
- **Purpose:** Phase 7: Analytics Consolidation Drops the dead engagement_scores table, creates a dedicated analytics schema, and introduces a unified analytics.events table for all new analytics writes. Migration plan: The existing analytics tables (page_views, user_events, search_analytics, listing_analytics, et
- **Tables created:** analytics.events
- **Tables altered:** analytics.events
- **RLS policies created:** 4
- **DROPS:** POLICY:IF, TABLE:public.engagement_scores, POLICY:"analytics_events_service_role", POLICY:"analytics_events_admin_read", POLICY:"analytics_events_own_read", POLICY:"analytics_events_own_insert"

#### `20260517000000_seed_industry_calculator_leads.sql`

- **Date:** 2026-05-17 | **Size:** 11.6KB
- **Purpose:** Seed valuation_leads from industry calculator export Maps: service_type → calculator_type, revenue_ltm → revenue, ebitda_ltm → ebitda, trend_24m → growth_trend, tier → quality_tier, city+region → location Unmapped columns (scores, facility, narrative, property values, etc.) are ignored.

#### `20260517100000_prevent_duplicate_buyers.sql`

- **Date:** 2026-05-17 | **Size:** 4.1KB
- **Purpose:** PREVENT DUPLICATE BUYERS — Database-Level Guardrails Strategy: website domain is the canonical unique identifier for buyers. Buyers without a website are not permitted (enforced at application layer; the unique domain index enforces it at the DB layer for rows that do have one). This migration: 1. A

#### `20260517200000_merge_duplicate_buyers.sql`

- **Date:** 2026-05-17 | **Size:** 8.3KB
- **Purpose:** MERGE DUPLICATE BUYERS 3 active buyer pairs share the same website domain (found via v_duplicate_buyers): allstartoday.com → "Allstar Construction" (x2) valorexteriorpartners.com → "Valor Exterior Partners" (x2) windownation.com → "Window Nation" (x2) Strategy: keep the OLDEST reco

#### `20260517300000_require_buyer_website.sql`

- **Date:** 2026-05-17 | **Size:** 2.3KB
- **Purpose:** REQUIRE BUYER WEBSITE A website is the canonical unique identifier for a buyer. Buyers without a website cannot be deduplicated or properly managed. This migration: 1. Archives all active buyers with no website (or blank website) 2. Adds a NOT NULL + non-empty CHECK constraint on company_website
- **Tables altered:** public.buyers

### Week of 2026-05-18 — 9 migrations

#### `20260518000000_buyer_relationship_system.sql` ⚠️ DROP

- **Date:** 2026-05-18 | **Size:** 10.8KB
- **Purpose:** BUYER RELATIONSHIP SYSTEM Part A: PE Firm ↔ Platform Company parent-child model Part B: Marketplace signup integration columns Part C: Automated PE backfill pipeline tables New columns on buyers (formerly remarketing_buyers): parent_pe_firm_id, parent_pe_firm_name, is_marketplace_member,
- **Tables created:** public.pe_backfill_log, public.pe_backfill_review_queue, public.pe_link_queue
- **Tables altered:** public.buyers, public.pe_backfill_log, public.pe_backfill_review_queue, public.pe_link_queue
- **Functions/RPCs:** auto_set_parent_pe_firm_fields, cascade_pe_firm_name_change, check_parent_pe_firm_depth, trigger_pe_link_on_enrich
- **Triggers:** trg_auto_set_parent_pe_firm_fields, trg_cascade_pe_firm_name_change, trg_check_parent_pe_firm_depth, trg_pe_link_on_enrich
- **RLS policies created:** 3
- **DROPS:** TRIGGER:trg_check_parent_pe_firm_depth, TRIGGER:trg_auto_set_parent_pe_firm_fields, TRIGGER:trg_cascade_pe_firm_name_change, TRIGGER:trg_pe_link_on_enrich

#### `20260519000000_drop_dead_columns.sql` ⚠️ DROP

- **Date:** 2026-05-19 | **Size:** 1.4KB
- **Purpose:** CLEANUP: Drop unused columns + fix stale CHECK constraints confidence_level: Added in migration 20260122202458 but never read or written by any edge function, frontend component, or type definition. Zero references.
- **Tables altered:** public.buyer_type_profiles, public.buyers
- **DROPS:** COLUMN:confidence_level

#### `20260520000000_add_similarity_search_rpcs.sql`

- **Date:** 2026-05-20 | **Size:** 1.4KB
- **Purpose:** ADD SIMILARITY SEARCH RPCs Used by: backfill-pe-platform-links (search_pe_firms_by_similarity) handle-buyer-approval (search_buyers_by_similarity) RPC: search PE firms by name similarity (for backfill pipeline)
- **Functions/RPCs:** search_buyers_by_similarity, search_pe_firms_by_similarity

#### `20260521000000_schedule_pe_backfill_cron.sql`

- **Date:** 2026-05-21 | **Size:** 1.1KB
- **Purpose:** SCHEDULE PE BACKFILL CRON JOB Runs backfill-pe-platform-links daily at 3am UTC. Uses pg_cron extension (available in Supabase). The function is called via pg_net HTTP extension to invoke the edge function. Ensure pg_cron and pg_net are available

#### `20260522000000_restore_listing_notes.sql`

- **Date:** 2026-05-22 | **Size:** 1.1KB
- **Purpose:** Restore listing_notes table that was incorrectly dropped in 20260503000000. The ListingNotesLog component on the deal Contact History tab actively uses this table.
- **Tables created:** public.listing_notes
- **Tables altered:** public.listing_notes
- **RLS policies created:** 3

#### `20260523000000_critical_security_fixes.sql`

- **Date:** 2026-05-23 | **Size:** 5.4KB
- **Purpose:** Critical Security Fixes Migration Addresses audit gaps C-4, C-5, C-6, C-8 C-5 FIX: Clear all existing plaintext passwords from referral_partners. The application code has been updated to stop writing this column.
- **Tables altered:** public.buyers, public.referral_partners
- **Functions/RPCs:** audit_buyer_changes, public.manage_user_role

#### `20260523000001_high_severity_fixes.sql` ⚠️ DROP

- **Date:** 2026-05-23 | **Size:** 6.6KB
- **Purpose:** High Severity Fixes Migration Addresses audit gaps H-5, H-6, H-7, H-10, H-11, H-12 H-5 FIX: Expand stage_type CHECK constraint to allow 'owner_intro' value for type-based automation triggers instead of hardcoded stage name strings. The column already exists with CHECK (stage_type IN ('active', 'clos
- **Tables altered:** public.deal_stages
- **Functions/RPCs:** public.auto_create_deal_from_approved_connection, public.handle_deal_close, public.sync_source_deal_financials
- **Triggers:** trg_auto_create_deal_from_connection, trg_handle_deal_close, trg_sync_source_deal_financials
- **DROPS:** TRIGGER:trg_handle_deal_close, TRIGGER:trg_sync_source_deal_financials, TRIGGER:trg_auto_create_deal_from_connection

#### `20260523000002_medium_severity_fixes.sql`

- **Date:** 2026-05-23 | **Size:** 3.3KB
- **Purpose:** Medium Severity Fixes Migration Addresses audit gaps M-2, M-5, M-6, M-8, M-9 M-2 FIX: Add tags/labels system for buyers. Simple JSONB array for flexible tagging without a join table.
- **Tables altered:** public.buyers, public.deal_pipeline, public.page_views, public.referral_partners

#### `20260524000000_add_deal_sources_array.sql` ⚠️ DROP

- **Date:** 2026-05-24 | **Size:** 1.3KB
- **Purpose:** Add deal_sources text[] column so a single listing can belong to multiple lead-source pipelines (e.g. both SourceCo and CapTarget). The existing deal_source column is kept for backward compatibility and updated via trigger to stay in sync. 1. Add the new column
- **Tables altered:** public.listings
- **Functions/RPCs:** public.sync_deal_source_from_sources
- **Triggers:** trg_sync_deal_source
- **DROPS:** TRIGGER:trg_sync_deal_source

### Week of 2026-05-25 — 6 migrations

#### `20260525000000_platform_audit_remediation.sql` ⚠️ DROP

- **Date:** 2026-05-25 | **Size:** 7.1KB
- **Purpose:** Platform Audit Remediation Migration Addresses findings from the March 2026 full system audit Priority: P1-P3 database-level fixes P3: Add stage timestamps to deal_pipeline for timeline reporting
- **Tables created:** enrichment_history
- **Tables altered:** buyers, deal_pipeline
- **Functions/RPCs:** enforce_connection_request_status_transition, generate_unique_listing_slug
- **Triggers:** trg_connection_request_status_transition
- **DROPS:** TRIGGER:trg_connection_request_status_transition

#### `20260526000000_buyer_enrichment_queue_add_paused_status.sql`

- **Date:** 2026-05-26 | **Size:** 0.4KB
- **Purpose:** Add 'paused' status to buyer_enrichment_queue check constraint This enables pause/resume support for buyer enrichment operations.
- **Tables altered:** public.buyer_enrichment_queue

#### `20260527000000_reactivate_pipeline_stages.sql`

- **Date:** 2026-05-27 | **Size:** 0.4KB
- **Purpose:** Remove the deactivated "Follow-up" and "NDA + Agreement Sent" stages permanently. These stages are no longer part of the pipeline spec. Any deals previously in these stages were already moved to "Approved" by migration 20260223033733.

#### `20260528000000_add_calendar_url_to_profiles.sql`

- **Date:** 2026-05-28 | **Size:** 0.3KB
- **Purpose:** Add calendar_url column to profiles table for per-presenter scheduling links
- **Tables altered:** profiles

#### `20260529000000_source_deal_id_cascade.sql`

- **Date:** 2026-05-29 | **Size:** 0.5KB
- **Purpose:** Fix source_deal_id FK to cascade SET NULL on delete. Prevents dangling references when a source deal is removed.
- **Tables altered:** public.listings

#### `20260530000000_buyer_outreach_tables.sql`

- **Date:** 2026-05-30 | **Size:** 3.6KB
- **Purpose:** Buyer Outreach Integration Creates tables for deal outreach profiles and buyer outreach event tracking 1. Deal Outreach Profiles — stores human-written merge variables per deal
- **Tables created:** buyer_outreach_events, deal_outreach_profiles
- **Tables altered:** buyer_outreach_events, deal_outreach_profiles
- **Triggers:** update_deal_outreach_profiles_updated_at
- **RLS policies created:** 10

### Week of 2026-06-01 — 10 migrations

#### `20260601000000_buyer_discovery_feedback.sql`

- **Date:** 2026-06-01 | **Size:** 3.8KB
- **Purpose:** Buyer Discovery Feedback Loop Stores accept/reject decisions from the deal team on buyer recommendations. Feedback operates at the NICHE level — rejecting a buyer on a fleet repair deal informs all future fleet repair searches, not just that one deal. This is the foundation for making every deal sma
- **Tables created:** buyer_discovery_feedback
- **Tables altered:** buyer_discovery_feedback, buyer_seed_log
- **RLS policies created:** 2

#### `20260602000000_buyer_seed_log_add_profile_columns.sql`

- **Date:** 2026-06-02 | **Size:** 0.9KB
- **Purpose:** ADD buyer_profile AND verification_status TO buyer_seed_log The seed-buyers function logs buyer_profile (the Pass 1 AI-generated profile) and verification_status (verified/unverified from Pass 2) but these columns were missing from the original table definition, causing silent insert failures and a
- **Tables altered:** public.buyer_seed_log

#### `20260602000001_relax_website_constraint_for_pe_firms.sql`

- **Date:** 2026-06-02 | **Size:** 1.1KB
- **Purpose:** RELAX buyers_website_required FOR PE FIRMS PE firms are auto-created as parent records when seeding platform companies. Claude often doesn't provide PE firm websites (the focus is on the platform company). The original constraint blocked these inserts, breaking the pe_firm_id linkage for seeded buye
- **Tables altered:** public.buyers

#### `20260603000000_contact_discovery_log.sql`

- **Date:** 2026-06-03 | **Size:** 2.2KB
- **Purpose:** Contact Discovery Log Tracks every buyer approval → contact search orchestration so outcomes are visible in the admin UI regardless of success or failure.
- **Tables created:** contact_discovery_log
- **Tables altered:** contact_discovery_log
- **RLS policies created:** 3

#### `20260604000000_drop_buyer_type_profiles.sql` ⚠️ DROP

- **Date:** 2026-06-04 | **Size:** 0.9KB
- **Purpose:** Drop buyer*type_profiles table This table was created in 20260204_buyer_fit_criteria_extraction.sql to store detailed profiles for different buyer types in a universe. It has zero .from() calls in any edge function or frontend code — no code reads or writes to it. The buyer_type_profiles_buyer_type*
- **DROPS:** TRIGGER:update_buyer_type_profiles_updated_at, POLICY:"Admins, TABLE:public.buyer_type_profiles

#### `20260605000000_ds_meeting_filter_and_cleanup.sql`

- **Date:** 2026-06-05 | **Size:** 2.0KB
- **Purpose:** 1. Add is_ds_meeting flag to standup_meetings 2. Backfill based on meeting_title containing <ds> 3. Delete ALL non-<ds> meetings, their tasks, and related data 4. Only <ds>-tagged meetings should appear in the standup tracker Step 1: Add is_ds_meeting column
- **Tables altered:** standup_meetings

#### `20260605000001_standardize_existing_task_titles.sql`

- **Date:** 2026-06-05 | **Size:** 1.3KB
- **Purpose:** Retroactively standardize task titles for consistency. Patterns: "find buyer(s) for X" → "Find Buyers for X", etc. 1. Standardize "find buyer" variants → "Find Buyers for ..."

#### `20260606000000_cleanup_non_deal_tasks.sql`

- **Date:** 2026-06-06 | **Size:** 2.5KB
- **Purpose:** Clean up non-deal tasks: hard delete platform/operations tasks, reclassify generic call/email tasks that reference a deal, delete orphan generic tasks with no deal link. Step 1: Delete deal_activities referencing platform/operations tasks

#### `20260607000000_add_featured_deal_ids.sql` ⚠️ DROP

- **Date:** 2026-06-07 | **Size:** 4.4KB
- **Purpose:** Add featured_deal_ids column to listings table. When set, these two deals are shown in the "Related Deals" section of the landing page instead of the default (most-recent) picks.
- **Tables altered:** public.listings
- **Functions/RPCs:** public.get_user_firm_agreement_status
- **DROPS:** FUNCTION:public.get_user_firm_agreement_status

#### `20260607000001_drop_docuseal_dead_code.sql` ⚠️ DROP

- **Date:** 2026-06-07 | **Size:** 0.7KB
- **Purpose:** Drop DocuSeal dead code: columns and webhook log table DocuSeal integration was fully replaced by PandaDoc. No active code references these columns or table. Drop DocuSeal columns from firm_agreements
- **Tables altered:** firm_agreements
- **DROPS:** COLUMN:nda_docuseal_submission_id, COLUMN:nda_docuseal_status, COLUMN:fee_docuseal_submission_id, COLUMN:fee_docuseal_status, TABLE:docuseal_webhook_log

### Week of 2026-06-08 — 7 migrations

#### `20260608000000_add_under_loi_flag.sql` ⚠️ DROP

- **Date:** 2026-06-08 | **Size:** 4.8KB
- **Purpose:** MIGRATION: Add "under LOI" flag to deal_pipeline Allows admins to mark a deal as "Under LOI" (Letter of Intent). When flagged, the deal card turns purple in the pipeline views. Follows the same pattern as the existing meeting_scheduled flag. 1. Add column to deal_pipeline
- **Tables altered:** public.deal_pipeline
- **Functions/RPCs:** public.get_deals_with_buyer_profiles
- **DROPS:** FUNCTION:public.get_deals_with_buyer_profiles

#### `20260609000000_align_profiles_buyer_type_constraint.sql`

- **Date:** 2026-06-09 | **Size:** 1.5KB
- **Purpose:** Align profiles.buyer_type CHECK constraint with canonical buyer type enum. The old constraint (chk_profiles_buyer_type_valid) only allowed 4 values: ('individual', 'corporate', 'fund', 'family_office') which is incompatible with the canonical 6-value enum established in migration 20260511000000_buye
- **Tables altered:** public.profiles

#### `20260610000000_add_data_room_text_content.sql`

- **Date:** 2026-06-10 | **Size:** 1.1KB
- **Purpose:** Add text_content column to data_room_documents for storing extracted text from uploaded documents. This text is used as context for deal enrichment and lead memo generation.
- **Tables altered:** data_room_documents, valuation_leads

#### `20260611000000_fix_contact_list_members_trigger.sql` ⚠️ DROP

- **Date:** 2026-06-11 | **Size:** 0.3KB
- **Purpose:** Drop the invalid updated_at trigger on contact_list_members. The table has no updated_at column, so the generic update_updated_at_column() function fails with: record "new" has no field "updated_at"
- **DROPS:** TRIGGER:update_contact_list_members_updated_at

#### `20260613000000_upsert_buyer_contact.sql`

- **Date:** 2026-06-13 | **Size:** 6.0KB
- **Purpose:** MIGRATION: Add upsert_buyer_contact RPC function Problem: The frontend "Add Contact" mutation uses a plain INSERT which fails when unique constraints are violated (duplicate email or duplicate name+buyer). The mirror trigger already handles ON CONFLICT but the direct insert path doesn't. This functi
- **Functions/RPCs:** public.update_buyer_contact, public.upsert_buyer_contact

#### `20260614000000_add_hired_broker_to_listings.sql` ⚠️ DROP

- **Date:** 2026-06-14 | **Size:** 2.0KB
- **Purpose:** Add hired_broker boolean flag to listings table
- **Tables altered:** contact_list_members, listings, remarketing_buyer_contacts
- **Functions/RPCs:** resolve_contact_list_member_contact_id
- **Triggers:** trg_resolve_contact_id
- **DROPS:** TRIGGER:trg_resolve_contact_id

#### `20260614000001_add_archive_reason_to_listings.sql`

- **Date:** 2026-06-14 | **Size:** 0.3KB
- **Purpose:** Add archive_reason column to listings table for storing why a deal was archived
- **Tables altered:** public.listings

### Week of 2026-06-15 — 11 migrations

#### `20260615000000_consolidate_agreement_status.sql` ⚠️ DROP

- **Date:** 2026-06-15 | **Size:** 9.1KB
- **Purpose:** Consolidate agreement status: add firm_id to get_my_agreement_status() so buyer-facing code has a single source of truth for all agreement data. Also adds server-side gating to enhanced_merge_or_create_connection_request. 1. Extend get_my_agreement_status to return firm_id
- **Tables altered:** buyer_introductions, deal_pipeline
- **Functions/RPCs:** invalidate_recommendation_cache_on_listing_change, public.enhanced_merge_or_create_connection_request, public.get_my_agreement_status
- **Triggers:** trg_invalidate_recommendation_cache
- **DROPS:** FUNCTION:public.get_my_agreement_status, TRIGGER:trg_invalidate_recommendation_cache

#### `20260616000000_pipeline_introduction_fixes.sql` ⚠️ DROP

- **Date:** 2026-06-16 | **Size:** 3.9KB
- **Purpose:** Pipeline & Introduction System Fixes Issues #30, #36, #40 from remarketing audit #30: Add buyer_introduction_id to deal_pipeline for traceability
- **Tables altered:** deal_pipeline, public.listings, public.smartlead_reply_inbox
- **Functions/RPCs:** invalidate_cache_on_universe_change, sync_pipeline_close_to_introduction
- **Triggers:** trg_invalidate_cache_universe, trg_sync_pipeline_to_introduction
- **DROPS:** VIEW:not_yet_introduced_buyers, TABLE:introduction_activity, TRIGGER:trg_invalidate_cache_universe, TRIGGER:trg_sync_pipeline_to_introduction

#### `20260617000000_client_portal_tables.sql` ⚠️ DROP

- **Date:** 2026-06-17 | **Size:** 25.6KB
- **Purpose:** Client Portal: 6 new tables for the portal feature portal_organizations, portal_users, portal_deal_pushes, portal_deal_responses, portal_notifications, portal_activity_log IMPORTANT: This migration only creates NEW tables. It does NOT alter any existing table, view, function, trigger, or RLS policy.
- **Tables created:** portal_activity_log, portal_deal_pushes, portal_deal_responses, portal_notifications, portal_organizations, portal_users, public.contact_assignments, public.email_access_log, public.email_connections, public.email_messages
- **Tables altered:** portal_activity_log, portal_deal_pushes, portal_deal_responses, portal_notifications, portal_organizations, portal_users, public.contact_assignments, public.email_access_log, public.email_connections, public.email_messages
- **Functions/RPCs:** is_portal_member, protect_sensitive_profile_fields, public.update_email_connection_timestamp, public.user_has_email_access
- **Triggers:** trg_protect_profile_fields, trigger_email_connections_updated_at
- **RLS policies created:** 27
- **DROPS:** POLICY:"Approved, POLICY:"Users, POLICY:"Users, TRIGGER:trg_protect_profile_fields

#### `20260617000001_outlook_email_audit_fixes.sql` ⚠️ DROP

- **Date:** 2026-06-17 | **Size:** 7.3KB
- **Purpose:** Outlook Email Integration — Audit Fixes Addresses critical issues found during comprehensive security audit. 1. FIX: Tighten INSERT policy on email_messages Users can only INSERT emails for contacts/deals they're assigned to. (Service role used by sync engine bypasses RLS entirely.)
- **Tables created:** public.outlook_webhook_events
- **Tables altered:** public.email_connections, public.email_messages, public.outlook_webhook_events
- **Functions/RPCs:** public.user_has_email_access
- **RLS policies created:** 2
- **DROPS:** POLICY:"Users

#### `20260617100000_add_portal_source_to_constraints.sql`

- **Date:** 2026-06-17 | **Size:** 1.3KB
- **Purpose:** Add 'portal' as a valid source value for connection_requests and deal_pipeline. Required by the Client Portal "Convert to Pipeline Deal" flow which creates connection requests with source = 'portal'. This migration ONLY modifies CHECK constraints (not table structure). ── connection_requests.source
- **Tables altered:** public.connection_requests, public.deal_pipeline

#### `20260618000000_portal_enhancements.sql`

- **Date:** 2026-06-18 | **Size:** 6.8KB
- **Purpose:** Portal enhancements: messaging, data room link, RLS fix, notification tracking This migration adds deal-level messaging, links portal deals to data room access, and fixes the internal_notes security issue. ── 1. Portal deal messages (deal-level chat between admin and portal users) ──
- **Tables created:** portal_deal_messages
- **Tables altered:** portal_deal_messages, portal_deal_pushes, public.deal_activities, public.deal_alerts, public.deal_comments, public.deal_contacts, public.deal_documents, public.deal_notes, public.deal_referrals, public.deal_scoring_adjustments …
- **Functions/RPCs:** portal_responses_for_user
- **RLS policies created:** 3

#### `20260619000000_comprehensive_workflow_automation.sql` ⚠️ DROP

- **Date:** 2026-06-19 | **Size:** 23.4KB
- **Purpose:** COMPREHENSIVE WORKFLOW AUTOMATION MIGRATION Date: 2026-04-07 Purpose: Fix deal_activities population, add auto-task creation, recurring tasks, task templates, stale deal detection, daily digest, and overdue escalation infrastructure. 0. FIX daily_standup_tasks STATUS CONSTRAINT
- **Tables created:** task_templates
- **Tables altered:** daily_standup_tasks, deal_activities, deal_pipeline, task_templates
- **Functions/RPCs:** auto_create_stage_tasks, auto_recur_completed_task, log_deal_activity, log_deal_assignment_change, log_task_completion_to_deal, trigger_auto_fireflies_sync, trigger_daily_digest, trigger_overdue_task_check …
- **Triggers:** trg_auto_create_stage_tasks, trg_auto_recur_completed_task, trg_log_deal_assignment_change, trg_log_task_completion_to_deal, trg_update_deal_last_activity
- **RLS policies created:** 2
- **DROPS:** TRIGGER:trg_update_deal_last_activity, TRIGGER:trg_auto_create_stage_tasks, TRIGGER:trg_log_deal_assignment_change, TRIGGER:trg_auto_recur_completed_task, TRIGGER:trg_log_task_completion_to_deal

#### `20260619000001_remaining_workflow_gaps.sql` ⚠️ DROP

- **Date:** 2026-06-19 | **Size:** 8.6KB
- **Purpose:** REMAINING WORKFLOW GAPS MIGRATION Date: 2026-04-07 Purpose: Auto-completion rules, per-deal cadence, last_contacted_at, auto-approve threshold, and enrichment diff tracking. 1. TASK AUTO-COMPLETION RULES (Gap #2) Maps task types to database state changes for auto-detection
- **Tables created:** task_auto_completion_rules
- **Tables altered:** contacts, deal_pipeline, task_auto_completion_rules
- **Functions/RPCs:** check_task_auto_completion, update_contact_last_contacted_call, update_contact_last_contacted_email, update_contact_last_contacted_linkedin
- **Triggers:** trg_update_contact_last_contacted_call, trg_update_contact_last_contacted_email, trg_update_contact_last_contacted_linkedin
- **RLS policies created:** 2
- **DROPS:** TRIGGER:trg_update_contact_last_contacted_email, TRIGGER:trg_update_contact_last_contacted_call, TRIGGER:trg_update_contact_last_contacted_linkedin

#### `20260620000000_add_additional_phone_numbers.sql`

- **Date:** 2026-06-20 | **Size:** 0.6KB
- **Purpose:** ADD ADDITIONAL PHONE NUMBERS TO PROFILES Date: 2026-04-08 Purpose: Allow marketplace contacts to store multiple phone numbers. The existing phone_number column remains as the primary number; additional_phone_numbers stores any extra numbers.
- **Tables altered:** profiles

#### `20260620000001_bulk_update_connection_request_status.sql`

- **Date:** 2026-06-20 | **Size:** 2.2KB
- **Purpose:** BULK UPDATE CONNECTION REQUEST STATUS Date: 2026-04-08 Purpose: Allow admins to update many connection request statuses in one call instead of one-by-one, preventing rate limits and timeouts.
- **Functions/RPCs:** public.bulk_update_connection_request_status

#### `20260621000000_captarget_performance_indexes.sql`

- **Date:** 2026-06-21 | **Size:** 1.0KB
- **Purpose:** Performance indexes for CapTarget leads page The main query filters by deal_source='captarget' and sorts by captarget_contact_date DESC. Without a composite index, Postgres must scan all matching rows then sort in memory. Composite index: covers the WHERE + ORDER BY in a single B-tree scan

### Week of 2026-06-22 — 22 migrations

#### `20260622000000_portal_access_rpc.sql`

- **Date:** 2026-06-22 | **Size:** 3.4KB
- **Purpose:** Portal access RPC — bypasses RLS for the initial portal access check. The portal_organizations table has RLS policies that rely on is_admin() and is_portal_member(). If those checks fail (sync issues, timing, etc.) the frontend cannot even read the org row to determine access. This SECURITY DEFINER
- **Functions/RPCs:** public.resolve_portal_access

#### `20260623000000_portal_security_fixes.sql` ⚠️ DROP

- **Date:** 2026-06-23 | **Size:** 6.4KB
- **Purpose:** Migration: Portal Security Fixes Date: 2026-06-23 Description: Fixes multiple security and integrity issues found in portal audit 1. FIX: Viewer role can submit deal responses (privilege escalation) Restrict INSERT on portal_deal_responses to admin and primary_contact roles. Viewers should not be ab
- **Tables altered:** public.contact_assignments
- **Functions/RPCs:** check_portal_push_update, public.track_portal_login
- **Triggers:** trg_check_portal_push_update
- **RLS policies created:** 3
- **DROPS:** POLICY:"Portal, POLICY:"Portal, TRIGGER:trg_check_portal_push_update, POLICY:"Admins

#### `20260624000000_portal_cleanup_unused_response_types.sql`

- **Date:** 2026-06-24 | **Size:** 1.9KB
- **Purpose:** Client Portal cleanup: remove unused response types and push statuses. The portal deal detail UI now offers only three client actions: • Connect with Owner → response_type = 'interested' • Learn More From SourceCo → response_type = 'need_more_info' • Pass → response_type
- **Tables altered:** portal_deal_pushes, portal_deal_responses

#### `20260625000000_deal_pipeline_close_capture.sql`

- **Date:** 2026-06-25 | **Size:** 1.9KB
- **Purpose:** Capture close-reason and final outcome data on deal_pipeline. Adds structured columns so Closed Won and Closed Lost can carry metadata for reporting (revenue recognized, loss post-mortems) instead of relying on free-text notes.
- **Tables altered:** public.deal_pipeline

#### `20260625000000_freeze_shared_utilities.sql`

- **Date:** 2026-06-25 | **Size:** 2.7KB
- **Purpose:** MIGRATION: Freeze shared utility functions Part of the database-duplicates remediation plan tracked in DATABASE_DUPLICATES_AUDIT_2026-04-09.md §3. Two generic helpers have been CREATE OR REPLACE'd repeatedly across the migration history with identical bodies: \* public.update_updated_at_column() — 6
- **Functions/RPCs:** public.is_admin, public.update_updated_at_column

#### `20260625000001_deal_pipeline_stage_flag_sync.sql` ⚠️ DROP

- **Date:** 2026-06-25 | **Size:** 2.0KB
- **Purpose:** Keep deal_pipeline.nda_status and fee_agreement_status in sync with the stage the deal is moved into. Previously a drag from "Approved" → "NDA Signed" would leave nda_status='not_sent' silently, creating conflicting state that the data-room tab and RLS policies downstream relied on. This trigger is
- **Functions/RPCs:** public.sync_deal_flags_from_stage
- **Triggers:** trg_sync_deal_flags_from_stage
- **DROPS:** TRIGGER:trg_sync_deal_flags_from_stage

#### `20260625000001_idempotent_chat_and_analytics_indexes.sql`

- **Date:** 2026-06-25 | **Size:** 2.4KB
- **Purpose:** MIGRATION: Idempotent chat and analytics indexes (defensive) Part of the database-duplicates remediation plan tracked in DATABASE_DUPLICATES_AUDIT_2026-04-09.md §5. Historical migrations defined a handful of indexes with a mix of `CREATE INDEX` (bare) and `CREATE INDEX IF NOT EXISTS` forms across mu

#### `20260625000002_consolidate_admin_view_state.sql` ⚠️ DROP

- **Date:** 2026-06-25 | **Size:** 5.7KB
- **Purpose:** MIGRATION: Consolidate admin "last viewed" state into admin_view_state Part of the database-duplicates remediation plan tracked in DATABASE_DUPLICATES_AUDIT_2026-04-09.md §1.1. The unified `admin_view_state` table was introduced in 20260516000000_add_sourceco_to_dashboard_stats.sql (lines 172–216) a
- **DROPS:** VIEW:public.admin_connection_requests_views_v2, VIEW:public.admin_deal_sourcing_views_v2, VIEW:public.admin_owner_leads_views_v2, VIEW:public.admin_users_views_v2, TABLE:public.admin_connection_requests_views, TABLE:public.admin_deal_sourcing_views

#### `20260625000003_merge_audit_log_into_audit_logs.sql` ⚠️ DROP

- **Date:** 2026-06-25 | **Size:** 6.7KB
- **Purpose:** MIGRATION: Merge audit_log (singular) into audit_logs (plural) Part of the database-duplicates remediation plan tracked in DATABASE_DUPLICATES_AUDIT_2026-04-09.md §1.5. Two parallel audit tables coexist today: \* public.audit_logs (plural) — created 20260203000000_audit_logging.sql Business-entity
- **Functions/RPCs:** public.generic_audit_trigger
- **DROPS:** POLICY:"Admins, POLICY:"Service, POLICY:"Admins, TABLE:public.audit_log

#### `20260625000004_extend_contacts_schema.sql`

- **Date:** 2026-06-25 | **Size:** 6.5KB
- **Purpose:** MIGRATION: Extend contacts schema for unified canonical store Part of the contact consolidation strategy. Adds the fields that today force enrichment/role/priority data to live in parallel tables (enriched_contacts, and the already-dropped pe_firm_contacts and platform_contacts). Purely additive — n
- **Tables altered:** public.contacts

#### `20260625000005_create_contact_events.sql` ⚠️ DROP

- **Date:** 2026-06-25 | **Size:** 6.8KB
- **Purpose:** MIGRATION: Create contact_events history log and backfill from enriched_contacts Part of the contact consolidation strategy (phase 4a — additive only). Today enriched_contacts is a parallel store: every Clay/Prospeo/Blitz/ Serper webhook writes a row there AND a row into contacts, with no link betwe
- **Tables created:** public.contact_events
- **Tables altered:** public.contact_events
- **RLS policies created:** 2
- **DROPS:** POLICY:"contact_events_admin_read", POLICY:"contact_events_service_write"

#### `20260625000006_contacts_upsert_rpc.sql`

- **Date:** 2026-06-25 | **Size:** 13.5KB
- **Purpose:** MIGRATION: contacts_upsert RPC and resolve_contact_identity helper Part of the contact consolidation strategy (phase 2a — additive). Introduces the single write path for the contacts table: public.resolve_contact_identity(p_email, p_linkedin, p_phone, p_firm_id) → UUID public.contacts_upsert(p_ident
- **Functions/RPCs:** public.contacts_upsert, public.resolve_contact_identity

#### `20260625000007_drop_remarketing_buyer_contacts.sql` ⚠️ DROP

- **Date:** 2026-06-25 | **Size:** 1.5KB
- **Purpose:** MIGRATION: Drop remarketing_buyer_contacts (dead mirror table) Part of the contact consolidation strategy (phase 5). remarketing_buyer_contacts was the legacy contact store for remarketing buyer universes. Since 20260228 all its data has been backfilled into the canonical contacts table, and a mirro
- **DROPS:** TRIGGER:trg_mirror_rbc_to_contacts, FUNCTION:public.mirror_rbc_to_contacts, TRIGGER:update_remarketing_contacts_updated_at, TABLE:public.remarketing_buyer_contacts

#### `20260625000008_revoke_direct_contacts_writes.sql`

- **Date:** 2026-06-25 | **Size:** 2.0KB
- **Purpose:** MIGRATION: Revoke direct INSERT/UPDATE on contacts Part of the contact consolidation strategy (phase 2 — final lockdown). All write call sites in src/ and supabase/functions/ have been migrated to call the contacts_upsert() SECURITY DEFINER RPC. The RPC runs as the function owner and is not affected

#### `20260625000009_drop_enriched_contacts.sql` ⚠️ DROP

- **Date:** 2026-06-25 | **Size:** 1.6KB
- **Purpose:** MIGRATION: Drop enriched_contacts table Part of the contact consolidation strategy (phase 4 — final cutover). enriched_contacts was a workspace-scoped enrichment cache written by Clay webhooks, find-contacts, enrich-list-contacts, and the AI command center enrichment tools. All of these writers have
- **DROPS:** POLICY:enriched_contacts_select, POLICY:enriched_contacts_service_insert, POLICY:enriched_contacts_service_update, TRIGGER:trg_enriched_contacts_updated_at, TABLE:public.enriched_contacts

#### `20260626000000_pipeline_deep_dive_fixes.sql` ⚠️ DROP

- **Date:** 2026-06-26 | **Size:** 16.5KB
- **Purpose:** PHASE 5: Fix the 12 backend findings from pipeline deep-dive audit Fixes: F-A1, F-A2, F-A3, F-A4, F-B2, F-Cross1, F-Cross2, F-Cross3, F-Int1, F-Schema1 Approach: 1. Drop the zombie function auto_create_deal_from_connection_request (F-A4) 2. Rewrite create_deal_on_request_approval to:
- **Tables created:** public.deal_pipeline_stage_log
- **Tables altered:** public.deal_pipeline, public.deal_pipeline_stage_log
- **Functions/RPCs:** public.create_deal_on_request_approval, public.create_pipeline_deal, public.log_deal_stage_change
- **Triggers:** trg_log_deal_stage_change
- **RLS policies created:** 1
- **DROPS:** FUNCTION:public.auto_create_deal_from_connection_request, TRIGGER:trg_sync_pipeline_to_introduction, TRIGGER:trg_log_deal_stage_change

#### `20260626000001_create_deal_from_introduction_rpc.sql`

- **Date:** 2026-06-26 | **Size:** 6.0KB
- **Purpose:** F-B1: Consolidate createDealFromIntroduction into a single SECURITY DEFINER RPC that runs in one transaction, replacing the 3-step client-side write. Client JS previously did: 1. Upsert buyer contact in contacts table 2. INSERT into deal_pipeline 3. UPDATE buyer_introductions SET introduction_status
- **Functions/RPCs:** public.create_deal_from_introduction

#### `20260626000002_deal_pipeline_rls_hardening.sql`

- **Date:** 2026-06-26 | **Size:** 1.9KB
- **Purpose:** F-RLS1: Add granular RLS policies to deal_pipeline Currently the only policy is "Admins can manage all deal_pipeline" which grants full CRUD to anyone with is_admin(auth.uid()). There is no per-user filtering for non-admin roles. This migration adds: 1. A read-only policy so buyers can see deals whe
- **RLS policies created:** 3

#### `20260627000000_pipeline_crm_completeness.sql`

- **Date:** 2026-06-27 | **Size:** 8.9KB
- **Purpose:** PIPELINE CRM COMPLETENESS: Fill every data-model gap surfaced by the 25-scenario SourceCo employee walkthrough. This migration adds fields, stages, and infrastructure to make the deal pipeline a genuine end-to-end CRM for M&A deal tracking, from first contact through LOI, closing, and commission pay
- **Tables altered:** public.deal_pipeline
- **Functions/RPCs:** public.sync_deal_flags_from_stage

#### `20260628000000_fix_task_templates_buyside.sql`

- **Date:** 2026-06-28 | **Size:** 2.0KB
- **Purpose:** G5 FIX: Replace sell-side DD checklist with buy-side check-in tasks. SourceCo makes introductions — the buyer runs their own DD. SourceCo's job during DD is to check in with both sides and track progress.

#### `20260628000001_pipeline_scenario_gap_fixes.sql` ⚠️ DROP

- **Date:** 2026-06-28 | **Size:** 2.2KB
- **Purpose:** G7 FIX: Update deal_pipeline.last_activity_at when a comment is added. The stale-deal detection checks last_activity_at, but deal_comments (Notes tab) is a separate table from deal_activities (History tab). Without this trigger, deals with weekly check-in notes still show as "stuck."
- **Tables altered:** public.deal_pipeline
- **Functions/RPCs:** public.update_deal_activity_on_comment
- **Triggers:** trg_update_deal_activity_on_comment
- **DROPS:** TRIGGER:trg_update_deal_activity_on_comment

#### `20260628000002_listing_level_deal_alerts.sql` ⚠️ DROP

- **Date:** 2026-06-28 | **Size:** 2.5KB
- **Purpose:** G10 FIX: Alert other deal owners when a deal on the same listing reaches LOI or closes. On a buy-side intro platform, when Blackstone signs an LOI with exclusivity, the advisor managing the Apex deal on the same listing needs to know immediately.
- **Functions/RPCs:** public.notify_listing_peers_on_milestone
- **Triggers:** trg_notify_listing_peers
- **DROPS:** TRIGGER:trg_notify_listing_peers

## 3. Edge Functions Not in Baseline Doc (likely new or undocumented)

_Functions absent from `docs/EDGE_FUNCTIONS.md`. Review and port these to the correct repo._

- **`admin-digest`** (10.8KB) — _(no header comment)_
- **`admin-reset-password`** (3.0KB) — _(no header comment)_
- **`aggregate-daily-metrics`** (9.5KB) — _(no header comment)_
- **`ai-command-center`** (9.2KB) — AI Command Center - Main Edge Function Endpoints: POST /ai-command-center — Main chat endpoint (SSE streaming)
- **`analyze-buyer-notes`** (13.9KB) — EDGE FUNCTION: analyze-buyer-notes PURPOSE: Extracts structured buyer investment criteria from general notes using
- **`analyze-deal-notes`** (25.0KB) — _(no header comment)_
- **`analyze-scoring-patterns`** (0.2KB) — _(no header comment)_
- **`analyze-tracker-notes`** (12.9KB) — _(no header comment)_
- **`apify-google-reviews`** (11.2KB) — _(no header comment)_
- **`apify-linkedin-scrape`** (39.8KB) — _(no header comment)_
- **`approve-marketplace-buyer`** (7.4KB) — approve-marketplace-buyer: Approves a pending marketplace buyer request
- **`approve-referral-submission`** (6.1KB) — _(no header comment)_
- **`auto-create-firm-on-approval`** (7.0KB) — _(no header comment)_
- **`auto-create-firm-on-signup`** (6.2KB) — _(no header comment)_
- **`auto-pair-all-fireflies`** (18.2KB) — _(no header comment)_
- **`auto-summarize-email-thread`** (6.9KB) — auto-summarize-email-thread Triggered when a deal accumulates 3+ emails in a single conversation thread. Collects the thread, sends to Gemini via OpenRouter, saves as deal_comment.
- **`auto-summarize-transcript`** (8.2KB) — auto-summarize-transcript Reads a transcript from deal_transcripts, sends it to Gemini via OpenRouter with an M&A-tuned prompt, and saves the structured summary as a deal_comment.
- **`backfill-daily-metrics`** (0.2KB) — _(no header comment)_
- **`backfill-heyreach-messages`** (13.6KB) — backfill-heyreach-messages One-shot manual-invocation function that pulls FULL historical HeyReach conversations and messages for existing campaigns. Ignores the
- **`backfill-match-tool-leads-enrichment`** (10.2KB) — One-shot backfill: enrich all match_tool_leads where enrichment_data IS NULL. Reuses the same Firecrawl + OpenAI logic as ingest-match-tool-lead. Safe to call multiple times (skips already-enriched ro
- **`backfill-match-tool-outreach`** (5.7KB) — _(no header comment)_
- **`backfill-pe-platform-links`** (20.7KB) — backfill-pe-platform-links: Automated PE firm → platform company linking Four-stage pipeline that converts pe_firm_name text fields into real parent_pe_firm_id foreign key relationships.
- **`backfill-smartlead-messages`** (12.8KB) — backfill-smartlead-messages One-shot manual-invocation function that pulls FULL historical SmartLead message history for existing campaigns. Unlike `sync-smartlead-messages`, it
- **`backfill-valuation-lead-contacts`** (21.6KB) — Backfill Valuation Lead Contacts — sequential, queue-backed, resumable runner. Architecture ------------
- **`backfill-valuation-leads`** (9.1KB) — _(no header comment)_
- **`brevo-webhook`** (10.4KB) — Brevo webhook handler for email engagement tracking + delivery logging. Receives Brevo webhook events (opens, clicks, bounces, etc.) and: 1. Writes engagement_signals for buyer scoring
- **`bulk-import-remarketing`** (33.9KB) — _(no header comment)_
- **`bulk-sync-all-fireflies`** (26.5KB) — _(no header comment)_
- **`calculate-buyer-quality-score`** (19.0KB) — _(no header comment)_
- **`calculate-deal-quality`** (23.8KB) — _(no header comment)_
- **`calculate-valuation-lead-score`** (12.9KB) — _(no header comment)_
- **`check-firm-domain`** (3.9KB) — check-firm-domain: Real-time domain check during signup Given an email address, checks if the domain matches any existing firm_agreements or remarketing_buyers record.
- **`check-overdue-tasks`** (12.2KB) — _(no header comment)_
- **`clarify-industry`** (8.1KB) — _(no header comment)_
- **`classify-buyer-types`** (8.5KB) — classify-buyer-types – AI classification using canonical 6-type taxonomy Uses Claude Sonnet to classify buyers into one of 6 canonical types: private_equity, corporate, family_office, search_fund, ind
- **`clay-webhook-linkedin`** (7.3KB) — Clay Webhook — LinkedIn Results Receiver Receives enriched contact data back from Clay after its waterfall enrichment. Clay sends results to this endpoint after processing a LinkedIn URL lookup.
- **`clay-webhook-name-domain`** (12.4KB) — Clay Webhook — Name + Domain Results Receiver Receives enriched contact data back from Clay after its waterfall enrichment. Clay sends results to this endpoint after processing a name+domain lookup.
- **`clay-webhook-phone`** (7.4KB) — Clay Webhook — Phone Results Receiver Receives enriched contact data back from Clay after its waterfall enrichment. Clay sends results to this endpoint after processing a LinkedIn URL phone lookup.
- **`cleanup-captarget-deals`** (5.6KB) — _(no header comment)_
- **`confirm-agreement-signed`** (0.2KB) — _(no header comment)_
- **`contacts-invariant-check`** (5.1KB) — _(no header comment)_
- **`convert-to-pipeline-deal`** (10.5KB) — _(no header comment)_
- **`create-lead-user`** (4.1KB) — _(no header comment)_
- **`create-pandadoc-document`** (0.2KB) — _(no header comment)_
- **`dedupe-buyers`** (5.5KB) — _(no header comment)_
- **`detect-stale-deals`** (5.6KB) — _(no header comment)_
- **`discover-companies`** (7.7KB) — Discover Companies Edge Function Google-powered company discovery: 1. Haiku builds optimized search queries from user intent
- **`draft-connection-message`** (7.7KB) — _(no header comment)_
- **`draft-reply-email`** (7.2KB) — draft-reply-email: AI-drafts a contextual reply to a Smartlead inbox response Admin-only. Uses the original sent message, the lead's reply, and AI classification to generate an appropriate follow-up e
- **`enhanced-admin-notification`** (4.8KB) — _(no header comment)_
- **`enhanced-email-delivery`** (0.2KB) — _(no header comment)_
- **`enrich-external-only`** (9.3KB) — _(no header comment)_
- **`enrich-geo-data`** (5.2KB) — _(no header comment)_
- **`enrich-list-contacts`** (11.2KB) — Enrich List Contacts — Prospeo enrichment for contacts being added to a list. Supports two modes: 1. contact_ids — enriches existing contacts from the contacts table by ID.
- **`enrich-match-tool-lead`** (10.8KB) — _(no header comment)_
- **`enrich-session-metadata`** (5.9KB) — _(no header comment)_
- **`enrich-valuation-lead-website`** (16.0KB) — _(no header comment)_
- **`error-logger`** (4.7KB) — _(no header comment)_
- **`extract-buyer-criteria`** (26.8KB) — _(no header comment)_
- **`extract-buyer-criteria-background`** (9.7KB) — _(no header comment)_
- **`extract-buyer-transcript`** (27.5KB) — _(no header comment)_
- **`extract-deal-document`** (19.1KB) — _(no header comment)_
- **`extract-deal-transcript`** (47.7KB) — _(no header comment)_
- **`extract-meeting-tasks`** (11.4KB) — _(no header comment)_
- **`extract-portal-thesis`** (23.0KB) — _(no header comment)_
- **`extract-standup-tasks`** (60.4KB) — eslint-disable no-console
- **`extract-transcript`** (42.6KB) — _(no header comment)_
- **`fetch-fireflies-content`** (14.7KB) — eslint-disable no-console
- **`find-contacts`** (51.9KB) — Find Contacts Edge Function Contact discovery pipeline with Blitz API as primary, Serper/Clay/Prospeo as fallbacks: 1. Check cache for recent results
- **`find-introduction-contacts`** (15.0KB) — Find Introduction Contacts Edge Function Auto-discovers contacts when a buyer is approved to the introduction stage. Calls the existing find-contacts edge function with title filters based on
- **`find-match-tool-lead-contacts`** (9.6KB) — find-match-tool-lead-contacts Auto-discovers LinkedIn URL and phone number for a Match Tool lead. Mirrors `find-valuation-lead-contacts` but scoped to `match_tool_leads`.
- **`find-valuation-lead-contacts`** (27.0KB) — Find Valuation Lead Contacts Edge Function Auto-discovers LinkedIn URL and phone number for a valuation lead. Called fire-and-forget by receive-valuation-lead after a new lead is saved.
- **`firecrawl-scrape`** (3.1KB) — _(no header comment)_
- **`fireflies-webhook`** (10.4KB) — fireflies-webhook Receives Fireflies webhook events (transcription_complete), fetches the full transcript, runs matching logic to link to deals + buyers, and triggers
- **`generate-buyer-intro`** (6.6KB) — _(no header comment)_
- **`generate-buyer-universe`** (10.2KB) — _(no header comment)_
- **`generate-call-summary`** (7.2KB) — _(no header comment)_
- **`generate-executive-summary`** (5.3KB) — _(no header comment)_
- **`generate-guide-pdf`** (5.8KB) — _(no header comment)_
- **`generate-listing-content`** (25.7KB) — generate-listing-content: AI-generates all marketplace listing content directly from deal data. Does NOT require a completed lead memo. Falls back to generate-marketplace-listing logic when a lead mem
- **`generate-ma-guide`** (57.6KB) — _(no header comment)_
- **`generate-ma-guide-background`** (4.3KB) — _(no header comment)_
- **`generate-marketplace-listing`** (28.1KB) — generate-marketplace-listing: AI-generates a buyer-grade HTML listing description from a completed lead memo. Admin-only. Reads the completed lead memo (single source of truth),
- **`generate-teaser`** (19.8KB) — generate-teaser: AI-generates an anonymous teaser from a completed lead memo. Admin-only. Reads the completed lead memo (single source of truth), transforms it into an anonymized buyer-facing teaser v
- **`generate-tracked-link`** (7.1KB) — generate-tracked-link: Creates a tracked document link for buyer distribution Admin-only. Generates a unique tracked link for a deal document, records the release in the immutable document_release_log
- **`get-agreement-document`** (3.6KB) — _(no header comment)_
- **`get-buyer-fee-embed`** (0.2KB) — _(no header comment)_
- **`get-buyer-nda-embed`** (0.2KB) — _(no header comment)_
- **`get-document-download`** (0.2KB) — _(no header comment)_
- **`get-feedback-analytics`** (1.3KB) — _(no header comment)_
- **`get-mapbox-token`** (1.5KB) — _(no header comment)_
- **`grant-data-room-access`** (9.3KB) — grant-data-room-access: Grants a buyer access to a deal's data room
- **`heyreach-campaigns`** (9.8KB) — HeyReach Campaigns Edge Function Handles CRUD operations for HeyReach LinkedIn outreach campaigns, proxying requests to the HeyReach API and keeping local tracking tables in sync.
- **`heyreach-leads`** (16.2KB) — HeyReach Leads Edge Function Manages lead operations: pushing contacts to HeyReach campaigns via lists, listing leads, and fetching lead details.
- **`heyreach-webhook`** (14.7KB) — HeyReach Webhook Receiver Receives webhook events from HeyReach (connection accepted, message received, reply, etc.) and logs them for processing.
- **`import-buyers`** (10.6KB) — _(no header comment)_
- **`import-reference-data`** (18.4KB) — _(no header comment)_
- **`ingest-match-tool-lead`** (11.7KB) — _(no header comment)_
- **`ingest-outreach-webhook`** (8.2KB) — Ingest Outreach Webhook — Unified webhook endpoint for buyer outreach events Receives POST requests from Smartlead, HeyReach, and PhoneBurner. Normalizes events and writes to buyer_outreach_events tab
- **`ingest-webflow-deal-lead`** (13.5KB) — _(no header comment)_
- **`invite-portal-user`** (10.7KB) — _(no header comment)_
- **`invite-team-member`** (6.4KB) — _(no header comment)_
- **`log-pdf-download`** (6.0KB) — log-pdf-download: Logs a PDF download release and generates a signed URL Admin-only. Records the document distribution in the immutable document_release_log (method = 'pdf_download') and returns a sho
- **`map-csv-columns`** (31.0KB) — _(no header comment)_
- **`notify-admin-document-question`** (2.0KB) — _(no header comment)_
- **`notify-admin-listing-saved`** (4.1KB) — _(no header comment)_
- **`notify-admin-new-message`** (5.7KB) — DEPRECATED: Admin message notifications are now handled via realtime subscriptions (toasts + dashboard). This function is no longer invoked but kept for reference.
- **`notify-agreement-confirmed`** (5.6KB) — notify-agreement-confirmed Sends an email to firm members when an admin marks their NDA or Fee Agreement as "signed". Differentiates copy based on agreement type:
- **`notify-buyer-inquiry-received`** (3.5KB) — _(no header comment)_
- **`notify-buyer-new-message`** (5.2KB) — _(no header comment)_
- **`notify-buyer-rejection`** (4.7KB) — _(no header comment)_
- **`notify-deal-owner-change`** (3.4KB) — _(no header comment)_
- **`notify-deal-reassignment`** (3.4KB) — _(no header comment)_
- **`notify-new-deal-owner`** (3.7KB) — _(no header comment)_
- **`notify-remarketing-match`** (4.4KB) — _(no header comment)_
- **`notify-support-inbox`** (4.7KB) — notify-support-inbox — Send a notification email to support@sourcecodeals.com whenever a buyer sends a message, requests documents, or an admin replies. Fire-and-forget from client. Lightweight, no au
- **`otp-rate-limiter`** (4.6KB) — _(no header comment)_
- **`outlook-auth`** (2.7KB) — outlook-auth: Initiates Microsoft OAuth 2.0 authorization code flow. Returns the Microsoft authorization URL that the frontend should redirect to. After consent, Microsoft redirects back to the outloo
- **`outlook-backfill-history`** (12.9KB) — outlook-backfill-history: Triggers a deep historical sync of the caller's Outlook mailbox against an extended lookback window. The initial connect-time sync already pulls 30 days of history by default
- **`outlook-bulk-backfill-all`** (9.4KB) — outlook-bulk-backfill-all: Admin-only one-click historical backfill for every active Outlook connection in the workspace. This is the operator escape hatch to roll out the Outlook integration fixes
- **`outlook-callback`** (8.8KB) — outlook-callback: Handles the Microsoft OAuth 2.0 callback. Exchanges the authorization code for tokens, stores the encrypted refresh token, fetches the user's email address, sets up the webhook subsc
- **`outlook-disconnect`** (5.3KB) — outlook-disconnect: Disconnects a team member's Outlook account. Revokes the webhook subscription, marks the connection as revoked, and clears the stored refresh token. Does NOT delete email history.
- **`outlook-renew-webhooks`** (6.6KB) — outlook-renew-webhooks: Renews Microsoft Graph webhook subscriptions before they expire. Should be called via pg_cron or scheduler every 12 hours. Also detects stale connections (no sync in 24+ hours)
- **`outlook-send-email`** (10.2KB) — outlook-send-email: Sends an email via Microsoft Graph on behalf of a team member. Supports both new composition and reply-to-thread. The sent email is automatically logged in the email_messages table
- **`outlook-sync-emails`** (33.6KB) — outlook-sync-emails: Syncs emails from Microsoft Graph to the platform. Modes: 1. Initial sync (isInitialSync=true): Pull `initialLookbackDays` of
- **`outlook-token-refresh`** (4.5KB) — outlook-token-refresh: Proactively refreshes OAuth tokens for all active connections. Should be called via scheduler every 30 minutes to ensure tokens stay fresh. If a token refresh fails 3 consecutiv
- **`outlook-webhook`** (5.1KB) — outlook-webhook: Receives real-time notifications from Microsoft Graph when new emails arrive or are sent in connected team members' mailboxes. Microsoft sends:
- **`pandadoc-integration-test`** (0.2KB) — _(no header comment)_
- **`pandadoc-webhook-handler`** (0.2KB) — _(no header comment)_
- **`parse-tracker-documents`** (4.9KB) — _(no header comment)_
- **`parse-transcript-file`** (5.7KB) — _(no header comment)_
- **`password-reset`** (8.5KB) — _(no header comment)_
- **`password-security`** (10.3KB) — _(no header comment)_
- **`phoneburner-oauth-callback`** (1.0KB) — PhoneBurner OAuth Callback — DEPRECATED OAuth flow has been removed. PhoneBurner tokens are now added manually via the admin settings page (paste access token directly).
- **`phoneburner-push-contacts`** (33.4KB) — PhoneBurner Push Contacts — Creates a dial session via PhoneBurner API Uses manually-provided access tokens stored in phoneburner_oauth_tokens. Uses POST /rest/1/dialsession which accepts contacts inl
- **`phoneburner-reprocess-logs`** (0.2KB) — _(no header comment)_
- **`phoneburner-webhook`** (55.6KB) — PhoneBurner Webhook Receiver Receives real-time call events from PhoneBurner and logs them into the `phoneburner_webhooks_log` and `contact_activities` tables.
- **`portal-auto-reminder`** (6.4KB) — _(no header comment)_
- **`process-buyer-enrichment-queue`** (22.8KB) — eslint-disable no-console
- **`process-buyer-universe-queue`** (12.4KB) — EDGE FUNCTION: process-buyer-universe-queue PURPOSE: Background queue worker that generates buyer universe labels and descriptions
- **`process-enrichment-queue`** (31.5KB) — EDGE FUNCTION: process-enrichment-queue PURPOSE: Background queue worker that processes pending deal enrichment jobs from the
- **`process-ma-guide-queue`** (16.9KB) — eslint-disable no-console
- **`process-portal-recommendations`** (7.1KB) — process-portal-recommendations Runs on cron every 5 minutes (see 20260703000001_portal_intelligence_audit_fixes.sql). Evaluates queued listings against all active portal thesis criteria and
- **`process-scoring-queue`** (12.6KB) — EDGE FUNCTION: process-scoring-queue PURPOSE: Background queue worker that processes pending deal scoring jobs from the
- **`process-smart-list-queue`** (19.0KB) — process-smart-list-queue Processes the smart list evaluation queue. Called by cron every 5 minutes. For each queued listing, evaluates it against all active seller smart lists.
- **`process-standup-webhook`** (10.0KB) — eslint-disable no-console
- **`publish-listing`** (9.8KB) — _(no header comment)_
- **`push-buyer-to-heyreach`** (7.1KB) — Push Buyer to HeyReach — Buyer Outreach Integration Accepts buyer IDs and a deal ID, fetches contact details and deal outreach profile variables, then pushes contacts to a HeyReach campaign with
- **`push-buyer-to-phoneburner`** (8.9KB) — Push Buyer to PhoneBurner — Buyer Outreach Integration Accepts buyer IDs and a deal ID, fetches contact details and deal outreach profile variables, generates a call script from the template, and crea
- **`push-buyer-to-smartlead`** (8.4KB) — Push Buyer to Smartlead — Buyer Outreach Integration Accepts buyer IDs and a deal ID, fetches contact details and deal outreach profile variables, then pushes contacts to a Smartlead campaign with
- **`quarantine-tier3-leads`** (3.0KB) — One-shot backfill: re-evaluates all non-quarantined match_tool_leads against the geo-tier + legitimacy gate using their existing enrichment_data. Does NOT call Firecrawl/OpenAI — purely re-classifies
- **`rate-limiter`** (6.0KB) — _(no header comment)_
- **`re-enrich-missing-addresses`** (0.2KB) — _(no header comment)_
- **`recalculate-deal-weights`** (0.3KB) — Stub — this function was removed but the directory remained. Kept as a no-op to prevent deploy failures.
- **`receive-valuation-lead`** (19.2KB) — _(no header comment)_
- **`record-data-room-view`** (9.6KB) — record-data-room-view: Public data room access endpoint (token-gated) PUBLIC — no authentication required. Access is gated by access_token. Accepts GET (query params) or POST (JSON body):
- **`record-link-open`** (5.6KB) — record-link-open: Tracks when a buyer opens a tracked document link PUBLIC endpoint — no authentication required. GET /view/:link_token
- **`redeem-invite-link`** (5.1KB) — _(no header comment)_
- **`request-agreement-email`** (15.2KB) — _(no header comment)_
- **`resolve-buyer-agreement`** (5.8KB) — resolve-buyer-agreement: Shared agreement resolution logic Determines whether a buyer is covered by an NDA or fee agreement, checking the buyer's own agreement first, then the parent PE firm's.
- **`resolve-buyer-message-thread`** (3.5KB) — _(no header comment)_
- **`salesforce-remarketing-webhook`** (11.5KB) — _(no header comment)_
- **`score-deal-buyers`** (33.5KB) — _(no header comment)_
- **`score-match-tool-lead`** (7.8KB) — score-match-tool-lead Lightweight scorer for match_tool_leads. Stage + financials + contact completeness drive a 0-100 score and quality_label / quality_tier.
- **`search-deal-history`** (10.5KB) — _(no header comment)_
- **`search-deal-transcripts`** (3.3KB) — EDGE FUNCTION: search-deal-transcripts PURPOSE: Searches across locally stored transcript text in deal_transcripts.
- **`search-fireflies-for-buyer`** (16.6KB) — eslint-disable no-console
- **`security-validation`** (10.4KB) — _(no header comment)_
- **`seed-buyers`** (50.2KB) — seed-buyers – AI Buyer Discovery Engine (v2 — Two-Pass PE-Backed Platform Discovery) Discovers PE-backed platform companies that are actively consolidating a specific niche through add-on acquisitions
- **`send-contact-response`** (3.7KB) — _(no header comment)_
- **`send-daily-digest`** (10.0KB) — _(no header comment)_
- **`send-data-recovery-email`** (3.8KB) — _(no header comment)_
- **`send-deal-referral`** (4.7KB) — _(no header comment)_
- **`send-fee-agreement-reminder`** (0.2KB) — _(no header comment)_
- **`send-feedback-email`** (3.2KB) — _(no header comment)_
- **`send-feedback-notification`** (4.4KB) — _(no header comment)_
- **`send-first-request-followup`** (4.6KB) — _(no header comment)_
- **`send-lead-agreement-email`** (13.0KB) — _(no header comment)_
- **`send-marketplace-invitation`** (4.1KB) — _(no header comment)_
- **`send-match-tool-lead-outreach`** (29.0KB) — _(no header comment)_
- **`send-nda-reminder`** (0.2KB) — _(no header comment)_
- **`send-onboarding-day2`** (5.7KB) — _(no header comment)_
- **`send-onboarding-day7`** (5.5KB) — _(no header comment)_
- **`send-owner-inquiry-notification`** (4.4KB) — _(no header comment)_
- **`send-owner-intro-notification`** (6.2KB) — _(no header comment)_
- **`send-password-reset-email`** (0.2KB) — _(no header comment)_
- **`send-portal-notification`** (6.1KB) — _(no header comment)_
- **`send-simple-verification-email`** (3.9KB) — _(no header comment)_
- **`send-task-notification-email`** (4.6KB) — _(no header comment)_
- **`send-templated-approval-email`** (6.9KB) — _(no header comment)_
- **`send-transactional-email`** (6.6KB) — send-transactional-email Consolidated transactional email sender that replaces 32 separate email edge functions with a single template-based sender.
- **`send-user-notification`** (3.7KB) — _(no header comment)_
- **`send-valuation-lead-outreach`** (29.8KB) — _(no header comment)_
- **`send-verification-email-with-apology`** (0.2KB) — _(no header comment)_
- **`send-verification-success-email`** (3.7KB) — _(no header comment)_
- **`session-heartbeat`** (5.4KB) — _(no header comment)_
- **`session-security`** (9.3KB) — _(no header comment)_
- **`smartlead-campaigns`** (11.8KB) — Smartlead Campaigns Edge Function Handles CRUD operations for Smartlead campaigns, proxying requests to the Smartlead API and keeping local tracking tables in sync.
- **`smartlead-inbox-webhook`** (33.8KB) — Smartlead Inbox Webhook Receives reply events from SmartLead (via n8n), classifies them with AI, and stores them in smartlead_reply_inbox.
- **`smartlead-leads`** (16.6KB) — Smartlead Leads Edge Function Manages lead operations: pushing contacts to Smartlead campaigns, listing leads, fetching message history, and updating lead categories.
- **`smartlead-reclassify-all`** (10.4KB) — Smartlead Reclassify All Admin-only endpoint that re-classifies ALL inbox records with the updated sentiment model (positive/activated/negative/neutral).
- **`smartlead-reclassify-failed`** (15.1KB) — Smartlead Reclassify Failed Admin-only endpoint that re-classifies inbox records that failed AI classification (defaulted to "neutral" with reasoning containing "failed").
- **`smartlead-webhook`** (5.7KB) — Smartlead Webhook Receiver Receives webhook events from Smartlead (email replied, bounced, unsubscribed, etc.) and logs them for processing.
- **`submit-referral-deal`** (6.1KB) — _(no header comment)_
- **`suggest-universe`** (6.6KB) — _(no header comment)_
- **`sync-captarget-sheet`** (28.7KB) — EDGE FUNCTION: sync-captarget-sheet PURPOSE: Syncs deal data from a CapTarget Google Sheet into the listings table.
- **`sync-fireflies-transcripts`** (20.2KB) — EDGE FUNCTION: sync-fireflies-transcripts PURPOSE: Syncs call transcripts from Fireflies.ai for a given deal. Searches by
- **`sync-heyreach-messages`** (17.3KB) — sync-heyreach-messages Forward-sync worker that pulls new HeyReach LinkedIn activity into `heyreach_messages` and `heyreach_unmatched_messages`. Runs every 20 min
- **`sync-missing-profiles`** (2.9KB) — _(no header comment)_
- **`sync-phoneburner-transcripts`** (6.3KB) — EDGE FUNCTION: sync-phoneburner-transcripts PURPOSE: Syncs call transcripts from PhoneBurner contact_activities into the unified
- **`sync-smartlead-messages`** (17.1KB) — sync-smartlead-messages Forward-sync worker that pulls new SmartLead email activity into `smartlead_messages` and `smartlead_unmatched_messages`. Runs every 20 min
- **`sync-standup-meetings`** (8.4KB) — eslint-disable no-console
- **`test-classify-buyer`** (11.7KB) — test-classify-buyer – Test buyer type classification on random or specific buyers Runs the AI classifier on a set of buyers WITHOUT writing results to the DB. Always operates in dry-run mode. Returns
- **`track-engagement-signal`** (4.3KB) — _(no header comment)_
- **`track-initial-session`** (9.0KB) — _(no header comment)_
- **`track-session`** (10.4KB) — _(no header comment)_
- **`trigger-contact-discovery`** (0.2KB) — _(no header comment)_
- **`user-journey-notifications`** (9.4KB) — _(no header comment)_
- **`validate-criteria`** (7.8KB) — _(no header comment)_
- **`validate-referral-access`** (8.6KB) — _(no header comment)_
- **`verify-platform-website`** (5.7KB) — _(no header comment)_

## 4. Complete Edge Function Inventory

_All 233 edge function directories. Marked ✓ if listed in baseline doc._

- 🆕 `admin-digest` (10.8KB)
- 🆕 `admin-reset-password` (3.0KB)
- 🆕 `aggregate-daily-metrics` (9.5KB)
- 🆕 `ai-command-center` (9.2KB)
- 🆕 `analyze-buyer-notes` (13.9KB)
- 🆕 `analyze-deal-notes` (25.0KB)
- 🆕 `analyze-scoring-patterns` (0.2KB)
- 🆕 `analyze-tracker-notes` (12.9KB)
- 🆕 `apify-google-reviews` (11.2KB)
- 🆕 `apify-linkedin-scrape` (39.8KB)
- 🆕 `approve-marketplace-buyer` (7.4KB)
- 🆕 `approve-referral-submission` (6.1KB)
- 🆕 `auto-create-firm-on-approval` (7.0KB)
- 🆕 `auto-create-firm-on-signup` (6.2KB)
- 🆕 `auto-pair-all-fireflies` (18.2KB)
- 🆕 `auto-summarize-email-thread` (6.9KB)
- 🆕 `auto-summarize-transcript` (8.2KB)
- 🆕 `backfill-daily-metrics` (0.2KB)
- 🆕 `backfill-heyreach-messages` (13.6KB)
- 🆕 `backfill-match-tool-leads-enrichment` (10.2KB)
- 🆕 `backfill-match-tool-outreach` (5.7KB)
- 🆕 `backfill-pe-platform-links` (20.7KB)
- 🆕 `backfill-smartlead-messages` (12.8KB)
- 🆕 `backfill-valuation-lead-contacts` (21.6KB)
- 🆕 `backfill-valuation-leads` (9.1KB)
- 🆕 `brevo-webhook` (10.4KB)
- 🆕 `bulk-import-remarketing` (33.9KB)
- 🆕 `bulk-sync-all-fireflies` (26.5KB)
- 🆕 `calculate-buyer-quality-score` (19.0KB)
- 🆕 `calculate-deal-quality` (23.8KB)
- 🆕 `calculate-valuation-lead-score` (12.9KB)
- 🆕 `check-firm-domain` (3.9KB)
- 🆕 `check-overdue-tasks` (12.2KB)
- 🆕 `clarify-industry` (8.1KB)
- 🆕 `classify-buyer-types` (8.5KB)
- 🆕 `clay-webhook-linkedin` (7.3KB)
- 🆕 `clay-webhook-name-domain` (12.4KB)
- 🆕 `clay-webhook-phone` (7.4KB)
- 🆕 `cleanup-captarget-deals` (5.6KB)
- 🆕 `confirm-agreement-signed` (0.2KB)
- 🆕 `contacts-invariant-check` (5.1KB)
- 🆕 `convert-to-pipeline-deal` (10.5KB)
- 🆕 `create-lead-user` (4.1KB)
- 🆕 `create-pandadoc-document` (0.2KB)
- ✓ `data-room-access` (14.7KB)
- ✓ `data-room-download` (4.8KB)
- ✓ `data-room-upload` (7.9KB)
- 🆕 `dedupe-buyers` (5.5KB)
- 🆕 `detect-stale-deals` (5.6KB)
- 🆕 `discover-companies` (7.7KB)
- 🆕 `draft-connection-message` (7.7KB)
- ✓ `draft-outreach-email` (7.4KB)
- 🆕 `draft-reply-email` (7.2KB)
- 🆕 `enhanced-admin-notification` (4.8KB)
- 🆕 `enhanced-email-delivery` (0.2KB)
- ✓ `enrich-buyer` (36.0KB)
- ✓ `enrich-deal` (45.8KB)
- 🆕 `enrich-external-only` (9.3KB)
- 🆕 `enrich-geo-data` (5.2KB)
- 🆕 `enrich-list-contacts` (11.2KB)
- 🆕 `enrich-match-tool-lead` (10.8KB)
- 🆕 `enrich-session-metadata` (5.9KB)
- 🆕 `enrich-valuation-lead-website` (16.0KB)
- 🆕 `error-logger` (4.7KB)
- 🆕 `extract-buyer-criteria` (26.8KB)
- 🆕 `extract-buyer-criteria-background` (9.7KB)
- 🆕 `extract-buyer-transcript` (27.5KB)
- 🆕 `extract-deal-document` (19.1KB)
- 🆕 `extract-deal-transcript` (47.7KB)
- 🆕 `extract-meeting-tasks` (11.4KB)
- 🆕 `extract-portal-thesis` (23.0KB)
- 🆕 `extract-standup-tasks` (60.4KB)
- 🆕 `extract-transcript` (42.6KB)
- 🆕 `fetch-fireflies-content` (14.7KB)
- 🆕 `find-contacts` (51.9KB)
- 🆕 `find-introduction-contacts` (15.0KB)
- 🆕 `find-match-tool-lead-contacts` (9.6KB)
- 🆕 `find-valuation-lead-contacts` (27.0KB)
- 🆕 `firecrawl-scrape` (3.1KB)
- 🆕 `fireflies-webhook` (10.4KB)
- 🆕 `generate-buyer-intro` (6.6KB)
- 🆕 `generate-buyer-universe` (10.2KB)
- 🆕 `generate-call-summary` (7.2KB)
- 🆕 `generate-executive-summary` (5.3KB)
- 🆕 `generate-guide-pdf` (5.8KB)
- ✓ `generate-lead-memo` (79.0KB)
- 🆕 `generate-listing-content` (25.7KB)
- 🆕 `generate-ma-guide` (57.6KB)
- 🆕 `generate-ma-guide-background` (4.3KB)
- 🆕 `generate-marketplace-listing` (28.1KB)
- 🆕 `generate-teaser` (19.8KB)
- 🆕 `generate-tracked-link` (7.1KB)
- 🆕 `get-agreement-document` (3.6KB)
- 🆕 `get-buyer-fee-embed` (0.2KB)
- 🆕 `get-buyer-nda-embed` (0.2KB)
- 🆕 `get-document-download` (0.2KB)
- 🆕 `get-feedback-analytics` (1.3KB)
- 🆕 `get-mapbox-token` (1.5KB)
- 🆕 `grant-data-room-access` (9.3KB)
- 🆕 `heyreach-campaigns` (9.8KB)
- 🆕 `heyreach-leads` (16.2KB)
- 🆕 `heyreach-webhook` (14.7KB)
- 🆕 `import-buyers` (10.6KB)
- 🆕 `import-reference-data` (18.4KB)
- 🆕 `ingest-match-tool-lead` (11.7KB)
- 🆕 `ingest-outreach-webhook` (8.2KB)
- 🆕 `ingest-webflow-deal-lead` (13.5KB)
- 🆕 `invite-portal-user` (10.7KB)
- 🆕 `invite-team-member` (6.4KB)
- 🆕 `log-pdf-download` (6.0KB)
- 🆕 `map-csv-columns` (31.0KB)
- 🆕 `notify-admin-document-question` (2.0KB)
- 🆕 `notify-admin-listing-saved` (4.1KB)
- 🆕 `notify-admin-new-message` (5.7KB)
- 🆕 `notify-agreement-confirmed` (5.6KB)
- 🆕 `notify-buyer-inquiry-received` (3.5KB)
- 🆕 `notify-buyer-new-message` (5.2KB)
- 🆕 `notify-buyer-rejection` (4.7KB)
- 🆕 `notify-deal-owner-change` (3.4KB)
- 🆕 `notify-deal-reassignment` (3.4KB)
- 🆕 `notify-new-deal-owner` (3.7KB)
- 🆕 `notify-remarketing-match` (4.4KB)
- 🆕 `notify-support-inbox` (4.7KB)
- 🆕 `otp-rate-limiter` (4.6KB)
- 🆕 `outlook-auth` (2.7KB)
- 🆕 `outlook-backfill-history` (12.9KB)
- 🆕 `outlook-bulk-backfill-all` (9.4KB)
- 🆕 `outlook-callback` (8.8KB)
- 🆕 `outlook-disconnect` (5.3KB)
- 🆕 `outlook-renew-webhooks` (6.6KB)
- 🆕 `outlook-send-email` (10.2KB)
- 🆕 `outlook-sync-emails` (33.6KB)
- 🆕 `outlook-token-refresh` (4.5KB)
- 🆕 `outlook-webhook` (5.1KB)
- 🆕 `pandadoc-integration-test` (0.2KB)
- 🆕 `pandadoc-webhook-handler` (0.2KB)
- ✓ `parse-fit-criteria` (17.8KB)
- 🆕 `parse-tracker-documents` (4.9KB)
- 🆕 `parse-transcript-file` (5.7KB)
- 🆕 `password-reset` (8.5KB)
- 🆕 `password-security` (10.3KB)
- 🆕 `phoneburner-oauth-callback` (1.0KB)
- 🆕 `phoneburner-push-contacts` (33.4KB)
- 🆕 `phoneburner-reprocess-logs` (0.2KB)
- 🆕 `phoneburner-webhook` (55.6KB)
- 🆕 `portal-auto-reminder` (6.4KB)
- 🆕 `process-buyer-enrichment-queue` (22.8KB)
- 🆕 `process-buyer-universe-queue` (12.4KB)
- 🆕 `process-enrichment-queue` (31.5KB)
- 🆕 `process-ma-guide-queue` (16.9KB)
- 🆕 `process-portal-recommendations` (7.1KB)
- 🆕 `process-scoring-queue` (12.6KB)
- 🆕 `process-smart-list-queue` (19.0KB)
- 🆕 `process-standup-webhook` (10.0KB)
- 🆕 `publish-listing` (9.8KB)
- 🆕 `push-buyer-to-heyreach` (7.1KB)
- 🆕 `push-buyer-to-phoneburner` (8.9KB)
- 🆕 `push-buyer-to-smartlead` (8.4KB)
- 🆕 `quarantine-tier3-leads` (3.0KB)
- 🆕 `rate-limiter` (6.0KB)
- 🆕 `re-enrich-missing-addresses` (0.2KB)
- 🆕 `recalculate-deal-weights` (0.3KB)
- 🆕 `receive-valuation-lead` (19.2KB)
- 🆕 `record-data-room-view` (9.6KB)
- 🆕 `record-link-open` (5.6KB)
- 🆕 `redeem-invite-link` (5.1KB)
- 🆕 `request-agreement-email` (15.2KB)
- 🆕 `resolve-buyer-agreement` (5.8KB)
- 🆕 `resolve-buyer-message-thread` (3.5KB)
- 🆕 `salesforce-remarketing-webhook` (11.5KB)
- 🆕 `score-deal-buyers` (33.5KB)
- 🆕 `score-match-tool-lead` (7.8KB)
- 🆕 `search-deal-history` (10.5KB)
- 🆕 `search-deal-transcripts` (3.3KB)
- 🆕 `search-fireflies-for-buyer` (16.6KB)
- 🆕 `security-validation` (10.4KB)
- 🆕 `seed-buyers` (50.2KB)
- ✓ `send-approval-email` (0.2KB)
- ✓ `send-connection-notification` (10.6KB)
- 🆕 `send-contact-response` (3.7KB)
- 🆕 `send-daily-digest` (10.0KB)
- 🆕 `send-data-recovery-email` (3.8KB)
- ✓ `send-deal-alert` (6.2KB)
- 🆕 `send-deal-referral` (4.7KB)
- 🆕 `send-fee-agreement-reminder` (0.2KB)
- 🆕 `send-feedback-email` (3.2KB)
- 🆕 `send-feedback-notification` (4.4KB)
- 🆕 `send-first-request-followup` (4.6KB)
- 🆕 `send-lead-agreement-email` (13.0KB)
- 🆕 `send-marketplace-invitation` (4.1KB)
- 🆕 `send-match-tool-lead-outreach` (29.0KB)
- ✓ `send-memo-email` (5.2KB)
- 🆕 `send-nda-reminder` (0.2KB)
- 🆕 `send-onboarding-day2` (5.7KB)
- 🆕 `send-onboarding-day7` (5.5KB)
- 🆕 `send-owner-inquiry-notification` (4.4KB)
- 🆕 `send-owner-intro-notification` (6.2KB)
- 🆕 `send-password-reset-email` (0.2KB)
- 🆕 `send-portal-notification` (6.1KB)
- 🆕 `send-simple-verification-email` (3.9KB)
- 🆕 `send-task-notification-email` (4.6KB)
- 🆕 `send-templated-approval-email` (6.9KB)
- 🆕 `send-transactional-email` (6.6KB)
- 🆕 `send-user-notification` (3.7KB)
- 🆕 `send-valuation-lead-outreach` (29.8KB)
- 🆕 `send-verification-email-with-apology` (0.2KB)
- 🆕 `send-verification-success-email` (3.7KB)
- 🆕 `session-heartbeat` (5.4KB)
- 🆕 `session-security` (9.3KB)
- 🆕 `smartlead-campaigns` (11.8KB)
- 🆕 `smartlead-inbox-webhook` (33.8KB)
- 🆕 `smartlead-leads` (16.6KB)
- 🆕 `smartlead-reclassify-all` (10.4KB)
- 🆕 `smartlead-reclassify-failed` (15.1KB)
- 🆕 `smartlead-webhook` (5.7KB)
- 🆕 `submit-referral-deal` (6.1KB)
- 🆕 `suggest-universe` (6.6KB)
- 🆕 `sync-captarget-sheet` (28.7KB)
- 🆕 `sync-fireflies-transcripts` (20.2KB)
- 🆕 `sync-heyreach-messages` (17.3KB)
- 🆕 `sync-missing-profiles` (2.9KB)
- 🆕 `sync-phoneburner-transcripts` (6.3KB)
- 🆕 `sync-smartlead-messages` (17.1KB)
- 🆕 `sync-standup-meetings` (8.4KB)
- 🆕 `test-classify-buyer` (11.7KB)
- 🆕 `track-engagement-signal` (4.3KB)
- 🆕 `track-initial-session` (9.0KB)
- 🆕 `track-session` (10.4KB)
- 🆕 `trigger-contact-discovery` (0.2KB)
- 🆕 `user-journey-notifications` (9.4KB)
- 🆕 `validate-criteria` (7.8KB)
- 🆕 `validate-referral-access` (8.6KB)
- 🆕 `verify-platform-website` (5.7KB)

## 5. Major Feature Themes

### Other / Uncategorized (111 migrations)

- `20260408133611_9fd44dbe-3b59-493e-8d12-8ba4ef89d41a.sql`
- `20260408133805_8eef0441-05ba-4c94-b7a6-11ea219d99ca.sql`
- `20260408140754_e905b07c-7534-444f-af59-15656cefa199.sql`
- `20260408155754_dfdb4f94-5b1b-42aa-9b3d-b73dfcd0435e.sql`
- `20260408161339_1e8dc6d2-f807-4055-b16e-6ea3ed515df3.sql`
- `20260408161412_5fbee3f1-7ea7-43d0-bc9c-96c73c5fffa2.sql`
- `20260408161603_b0242544-126e-4e03-8777-1d10faa84a07.sql`
- `20260408161639_46ec87c8-ae1f-4d04-a0ff-13a2c6465335.sql`
- `20260408162449_5d9c4e8d-8273-40fa-a601-f8c8f4a597d1.sql`
- `20260408162523_858622ba-4166-4592-bff4-2b67d861903a.sql`
- `20260408171257_a632ddd0-58e5-4793-ae42-1e5077d892b9.sql`
- `20260408181537_0a89bcf7-903b-4fb2-85e5-4d802dc300d4.sql`
- `20260413145741_d1722f5e-5640-433c-9311-1cb073f1e6e8.sql`
- `20260413150424_a69bf6df-0b01-4611-9838-0a223c297641.sql`
- `20260413151207_38536477-092d-4325-af21-c2731e086396.sql`
- `20260413153648_0e7f9bff-3e18-4763-8ba0-bdcbc04d2ca5.sql`
- `20260413170613_571acdbe-0ded-4e5c-a240-c3794d59bec6.sql`
- `20260413183853_18e549ec-01a0-4811-995c-6053e56801f5.sql`
- `20260413185412_699f01d1-8ad4-412c-aea7-6ea8ef1a7ba6.sql`
- `20260413201553_b19fbac1-c55d-48a0-8a3c-758acfed2830.sql`
- `20260413202035_8e9a1573-4ee8-4c10-aa6a-5d1ef73ce483.sql`
- `20260413203730_ab925ae7-de07-4c37-bca4-36def2af4b54.sql`
- `20260414042802_8d978b27-ab73-4efe-94c4-e722c62b15f2.sql`
- `20260414110434_7b232025-1405-4d9f-a861-eccc21be8af2.sql`
- `20260414112931_0076bdcc-0d22-4551-8534-2a6061be3139.sql`
- `20260414131051_e609ac4d-eed1-4fa4-ba92-c49f34dd1990.sql`
- `20260414133733_c29f927a-0e54-4588-8d4b-5d91bef9afb3.sql`
- `20260414174925_3f6e85d4-944a-4b59-ae63-aff1b711fdc7.sql`
- `20260414180048_068d6394-295e-479e-a7c7-97c206d5f68c.sql`
- `20260415100354_658edd74-ff2b-4f08-b2a8-cb55ca11eeff.sql`
- _…and 81 more_

### Marketplace Queue / Listings (9 migrations)

- `20260408200000_add_marketplace_queue_rank.sql`
- `20260501100000_drop_dead_listing_columns.sql`
- `20260506300000_drop_dead_listings_columns.sql`
- `20260515100000_drop_dead_listing_columns.sql`
- `20260522000000_restore_listing_notes.sql`
- `20260526000000_buyer_enrichment_queue_add_paused_status.sql`
- `20260614000000_add_hired_broker_to_listings.sql`
- `20260614000001_add_archive_reason_to_listings.sql`
- `20260628000002_listing_level_deal_alerts.sql`

### Buyer System Refactor (23 migrations)

- `20260501000000_buyer_recommendation_cache.sql`
- `20260501000001_remarketing_buyers_seeding_columns.sql`
- `20260501000002_buyer_seed_log.sql`
- `20260501000003_buyer_seed_cache.sql`
- `20260502100000_buyer_recommendation_hardening.sql`
- `20260503100000_clear_buyer_recommendation_caches.sql`
- `20260506000000_fix_buyer_introductions_rls.sql`
- `20260507000000_add_score_snapshot_to_buyer_introductions.sql`
- `20260511000000_add_remarketing_buyer_id_to_introductions.sql`
- `20260512000000_buyer_contact_at_signup.sql`
- `20260514000000_rename_remarketing_buyers_to_buyers.sql`
- `20260516200000_buyer_single_source_of_truth.sql`
- `20260517100000_prevent_duplicate_buyers.sql`
- `20260517200000_merge_duplicate_buyers.sql`
- `20260517300000_require_buyer_website.sql`
- `20260518000000_buyer_relationship_system.sql`
- `20260530000000_buyer_outreach_tables.sql`
- `20260601000000_buyer_discovery_feedback.sql`
- `20260602000000_buyer_seed_log_add_profile_columns.sql`
- `20260604000000_drop_buyer_type_profiles.sql`
- `20260609000000_align_profiles_buyer_type_constraint.sql`
- `20260613000000_upsert_buyer_contact.sql`
- `20260625000007_drop_remarketing_buyer_contacts.sql`

### Audit / Cleanup (10 migrations)

- `20260503000000_drop_unused_tables.sql`
- `20260504000000_fix_deals_rpc_connection_request_filter.sql`
- `20260519000000_drop_dead_columns.sql`
- `20260523000001_high_severity_fixes.sql`
- `20260523000002_medium_severity_fixes.sql`
- `20260525000000_platform_audit_remediation.sql`
- `20260605000000_ds_meeting_filter_and_cleanup.sql`
- `20260607000001_drop_docuseal_dead_code.sql`
- `20260625000003_merge_audit_log_into_audit_logs.sql`
- `20260628000000_fix_task_templates_buyside.sql`

### Contacts Unification (8 migrations)

- `20260506100000_migrate_deal_contact_fields.sql`
- `20260603000000_contact_discovery_log.sql`
- `20260611000000_fix_contact_list_members_trigger.sql`
- `20260625000004_extend_contacts_schema.sql`
- `20260625000005_create_contact_events.sql`
- `20260625000006_contacts_upsert_rpc.sql`
- `20260625000008_revoke_direct_contacts_writes.sql`
- `20260625000009_drop_enriched_contacts.sql`

### Deal Pipeline / CRM (11 migrations)

- `20260506200000_drop_deal_pipeline_duplicate_columns.sql`
- `20260508000000_add_deal_task_types.sql`
- `20260527000000_reactivate_pipeline_stages.sql`
- `20260606000000_cleanup_non_deal_tasks.sql`
- `20260616000000_pipeline_introduction_fixes.sql`
- `20260625000000_deal_pipeline_close_capture.sql`
- `20260625000001_deal_pipeline_stage_flag_sync.sql`
- `20260626000000_pipeline_deep_dive_fixes.sql`
- `20260626000002_deal_pipeline_rls_hardening.sql`
- `20260627000000_pipeline_crm_completeness.sql`
- `20260628000001_pipeline_scenario_gap_fixes.sql`

### Firm Resolution (2 migrations)

- `20260510000000_backfill_pe_firm_ids.sql`
- `20260602000001_relax_website_constraint_for_pe_firms.sql`

### Security Hardening / RLS (2 migrations)

- `20260513000000_add_assignee_rls_policy_standup_tasks.sql`
- `20260523000000_critical_security_fixes.sql`

### Event-Driven Architecture (1 migrations)

- `20260516400000_event_driven_architecture.sql`

### Webflow Ingestion (1 migrations)

- `20260517000000_seed_industry_calculator_leads.sql`

### Agreements / NDA / Fee (3 migrations)

- `20260528000000_add_calendar_url_to_profiles.sql`
- `20260605000001_standardize_existing_task_titles.sql`
- `20260615000000_consolidate_agreement_status.sql`

### Data Room / Vault (1 migrations)

- `20260610000000_add_data_room_text_content.sql`

### Client Portal (6 migrations)

- `20260617000000_client_portal_tables.sql`
- `20260617100000_add_portal_source_to_constraints.sql`
- `20260618000000_portal_enhancements.sql`
- `20260622000000_portal_access_rpc.sql`
- `20260623000000_portal_security_fixes.sql`
- `20260624000000_portal_cleanup_unused_response_types.sql`

### Outlook Integration (1 migrations)

- `20260617000001_outlook_email_audit_fixes.sql`

## 6. Audit / Report / Documentation Files

- `ADMIN_TESTING_AUDIT.md`
- `AUDIT_BUYER_SCORING_PIPELINE.md`
- `AUDIT_DEAL_PAGE_NOTES_2026-03-05.md`
- `AUDIT_REPORT.md`
- `AUDIT_REPORT_2026-02-26.md`
- `AUDIT_VERIFICATION_REPORT_2026-03-14.md`
- `AUTH_FLOW_AUDIT.md`
- `BUYER_EXPERIENCE_AUDIT_2026-03-01.md`
- `CHANGELOG.md`
- `CODEBASE_AUDIT_2026-03-02.md`
- `CODE_QUALITY_AUDIT.md`
- `CORE_SYSTEMS_AUDIT_2026-03-14.md`
- `CTO_AUDIT_REMARKETING.md`
- `CTO_CODEBASE_AUDIT_2026-03-11.md`
- `CTO_DEAD_CODE_DUPLICATES_AUDIT_2026-03-11.md`
- `CTO_DEAD_CODE_DUPLICATES_AUDIT_2026-03-12.md`
- `CTO_DEEP_AUDIT_2026-03-04.md`
- `CTO_PLATFORM_AUDIT_V2_2026-03-01.md`
- `DATABASE_DUPLICATES_AUDIT_2026-04-09.md`
- `DATA_ARCHITECTURE_AUDIT_2026-03-04.md`
- `INTEGRATION_AUDIT_2026-04-13.md`
- `MARKETPLACE_LISTING_AUDIT.md`
- `MARKETPLACE_LISTING_AUDIT_V2.md`
- `PLATFORM_AUDIT_2026-04-13.md`
- `PLATFORM_AUDIT_REPORT.md`
- `PLATFORM_WORKFLOW_AUDIT_2026-03-22.md`
- `REFERRAL_SYSTEM_AUDIT.md`
- `TASK_WORKFLOW_COMPREHENSIVE_AUDIT_2026-04-07.md`
- `TECHNICAL_DILIGENCE_AUDIT_2026-03-14.md`
- `docs/AI_TASK_SYSTEM_SPEC_v3.1.md`
- `docs/AI_TASK_SYSTEM_v3.1.md`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/AUDIT_DATA_ARCHITECTURE_v2.md`
- `docs/BUYER_EXPERIENCE_AUDIT_2026-04-07.md`
- `docs/CONTACT_DISCOVERY_WORKFLOW.md`
- `docs/CONTACT_SYSTEM.md`
- `docs/CTO_AUDIT_FINDINGS.md`
- `docs/DATABASE.md`
- `docs/DEAL_ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/EDGE_FUNCTIONS.md`
- `docs/IMPLEMENTATION_ROADMAP.md`
- `docs/REMARKETING_PIPELINE_AUDIT_2026-04-07.md`
- `docs/SCHEMA_REFACTOR_STRATEGY.md`
- `docs/TASK_STANDUP_TRACKING_SYSTEM.md`
- `docs/ai-command-center/01-REQUIREMENTS.md`
- `docs/ai-command-center/02-USER-STORIES.md`
- `docs/ai-command-center/03-TECHNICAL-ARCHITECTURE.md`
- `docs/ai-command-center/04-AI-BEST-PRACTICES.md`
- `docs/ai-command-center/05-TESTING-STRATEGY.md`
- `docs/ai-command-center/06-IMPLEMENTATION-ROADMAP.md`
- `docs/ai-command-center/07-VALUE-EXPANSION.md`
- `docs/architecture/DEAL_PAGE_SYSTEM_SPEC.md`
- `docs/architecture/PERMISSIONS_SYSTEM.md`
- `docs/deployment/DEPLOYMENT_PROMPT.md`
- `docs/deployment/EDGE_FUNCTION_DEPLOYMENT.md`
- `docs/deployment/FINAL_PRODUCTION_VERDICT.md`
- `docs/deployment/PRODUCTION_READINESS.md`
- `docs/deployment/PRODUCTION_READINESS_FINAL_ASSESSMENT.md`
- `docs/deployment/QUICK_DEPLOY.md`
- `docs/features/ADVANCED_FEATURES_INTEGRATION_GUIDE.md`
- `docs/features/BULK_IMPORT_STATUS.md`
- `docs/features/CHATBOT_DATA_ACCESS_AUDIT_REPORT.md`
- `docs/features/CHATBOT_IMPLEMENTATION_NOTES.md`
- `docs/features/CONVERSATION_PERSISTENCE_USAGE.md`
- `docs/features/CTO_CHATBOT_DEEP_DIVE.md`
- `docs/features/ENRICHMENT_AUDIT_REPORT.md`
- `docs/features/ENRICHMENT_INFRASTRUCTURE_AUDIT.md`
- `docs/features/ENRICHMENT_QUEUE_DEEP_AUDIT.md`
- `docs/features/ENRICHMENT_VERIFICATION.md`
- `docs/features/FIRM_AGREEMENTS_EXTENSION_GUIDE.md`
- `docs/features/FIRM_TRACKING_IMPLEMENTATION.md`
- `docs/features/LINKEDIN_MONITORING_GUIDE.md`
- `docs/features/LINKEDIN_VERIFICATION_IMPLEMENTATION.md`
- `docs/guides/ANALYTICS_TESTING_GUIDE.md`
- `docs/guides/SMOKE_TESTS.md`
- `docs/guides/TESTING_INSTRUCTIONS.md`
- `docs/phoneburner/data_schema_reference.md`
- `docs/phoneburner/implementation_checklist.md`
- `docs/phoneburner/integration_requirements.md`
- `docs/phoneburner/list_builder_ui_spec.md`
- `docs/security/AUDIT_RECONCILIATION.md`
- `docs/security/CTO_AUDIT_REPORT_POST_FIX.md`
- `docs/security/FINAL_SECURITY_VERIFICATION.md`
- `docs/security/PLATFORM_AUDIT_REPORT.md`
- `docs/security/SECURITY_AUDIT.md`
- `docs/security/SECURITY_AUDIT_SUMMARY.md`
- `docs/testing/ai-chatbot-testing-guide.md`
- `docs/testing/platform-testing-guide.md`

## 7. Frontend Notes

_Frontend file change detection requires git history (not available in this env). Use `git log --since=2026-04-08 --name-only -- src/` in the correct repo to enumerate. Major UI surfaces touched (per migration / memory references):_

- `src/pages/admin/**` — pipeline, marketplace queue, document tracking, universal search
- `src/pages/portal/**` — client portal full build
- `src/pages/admin/remarketing/**` — buyer system, match-tool leads, GP partner deals
- `src/components/marketplace/**` — listing card cleansing, sidebar redesign, financial sync
- `src/components/data-room/**` — Vault modal, dual-id access, lead memo v2
- `src/components/messaging/**` — buyer topic picker, listing inquiry flow
- `src/components/agreements/**` — unified document signing

## 8. Migration Replay Order (apply in this order)

```
20260408133611_9fd44dbe-3b59-493e-8d12-8ba4ef89d41a.sql
20260408133805_8eef0441-05ba-4c94-b7a6-11ea219d99ca.sql
20260408140754_e905b07c-7534-444f-af59-15656cefa199.sql
20260408155754_dfdb4f94-5b1b-42aa-9b3d-b73dfcd0435e.sql
20260408161339_1e8dc6d2-f807-4055-b16e-6ea3ed515df3.sql
20260408161412_5fbee3f1-7ea7-43d0-bc9c-96c73c5fffa2.sql
20260408161603_b0242544-126e-4e03-8777-1d10faa84a07.sql
20260408161639_46ec87c8-ae1f-4d04-a0ff-13a2c6465335.sql
20260408162449_5d9c4e8d-8273-40fa-a601-f8c8f4a597d1.sql
20260408162523_858622ba-4166-4592-bff4-2b67d861903a.sql
20260408171257_a632ddd0-58e5-4793-ae42-1e5077d892b9.sql
20260408181537_0a89bcf7-903b-4fb2-85e5-4d802dc300d4.sql
20260408200000_add_marketplace_queue_rank.sql
20260413145741_d1722f5e-5640-433c-9311-1cb073f1e6e8.sql
20260413150424_a69bf6df-0b01-4611-9838-0a223c297641.sql
20260413151207_38536477-092d-4325-af21-c2731e086396.sql
20260413153648_0e7f9bff-3e18-4763-8ba0-bdcbc04d2ca5.sql
20260413170613_571acdbe-0ded-4e5c-a240-c3794d59bec6.sql
20260413183853_18e549ec-01a0-4811-995c-6053e56801f5.sql
20260413185412_699f01d1-8ad4-412c-aea7-6ea8ef1a7ba6.sql
20260413201553_b19fbac1-c55d-48a0-8a3c-758acfed2830.sql
20260413202035_8e9a1573-4ee8-4c10-aa6a-5d1ef73ce483.sql
20260413203730_ab925ae7-de07-4c37-bca4-36def2af4b54.sql
20260414042802_8d978b27-ab73-4efe-94c4-e722c62b15f2.sql
20260414110434_7b232025-1405-4d9f-a861-eccc21be8af2.sql
20260414112931_0076bdcc-0d22-4551-8534-2a6061be3139.sql
20260414131051_e609ac4d-eed1-4fa4-ba92-c49f34dd1990.sql
20260414133733_c29f927a-0e54-4588-8d4b-5d91bef9afb3.sql
20260414174925_3f6e85d4-944a-4b59-ae63-aff1b711fdc7.sql
20260414180048_068d6394-295e-479e-a7c7-97c206d5f68c.sql
20260415100354_658edd74-ff2b-4f08-b2a8-cb55ca11eeff.sql
20260415103619_5e3c4a21-c610-43c4-a4aa-26eb24b5908a.sql
20260415105753_a5358b07-948d-441b-9f2d-b6a13f4768db.sql
20260415111113_14a24c7f-522d-495f-98a0-f7ccf03b7f63.sql
20260415111700_5819c48a-7367-419d-878e-72ead730b21a.sql
20260415115233_f9da0fcf-474c-4523-8569-67353c95772c.sql
20260415121817_4f6f8c8e-d782-4e60-9273-258df6dab0c9.sql
20260415125856_d1001ca1-5117-4f7a-aaa7-58e4af8f5b98.sql
20260415125929_1bc5ac24-7bd2-4db1-b895-8f5a652746ea.sql
20260415131348_3575528e-7e18-49c7-9a6c-8698dce9b2ed.sql
20260415143007_fe15ddd4-eb84-46e7-9435-d70128e9bbf3.sql
20260415173912_84f99688-3adf-4f84-9bf3-7dc1420ea0af.sql
20260415181114_507bda72-d174-42c3-b741-4a58fe910aa4.sql
20260415181712_4de4d1c4-921e-4211-a051-4ecb0551dace.sql
20260415183855_3f96ff13-b962-4250-ac74-da3dd5070c25.sql
20260415184758_591fbd44-c465-499a-af5b-294557bbf0a5.sql
20260415190042_261059ea-e99b-4307-974e-6672be39b2b1.sql
20260415190804_35eb2af1-bebf-41ed-84e0-85080ffb3ec1.sql
20260415191330_ff57e3cc-d174-485e-9fc0-3b8162bef04a.sql
20260415191813_8946da3d-6906-4fad-8f20-de4487f8eec1.sql
20260415192319_2c4481a9-bca5-4e53-936c-a53a66b5b016.sql
20260415192728_c3bf249d-d0d5-4e61-8bfd-4cf524443976.sql
20260415213331_6db139ee-d3a9-440c-807e-6586dbf7beeb.sql
20260415214030_f688f986-8a48-481c-9707-6f0357dfd8ea.sql
20260415215502_5bf86810-b7f5-448e-a04f-c4ac1b4f1082.sql
20260416095716_6a776bc7-0a2a-4dd7-b6a6-43a37f147b5c.sql
20260416105923_0ccb09e7-1b22-4c52-9a08-b8b484507fd3.sql
20260416115522_01d83e73-24df-4d7a-ace3-655e657eef67.sql
20260416120456_131e5208-1720-4145-b4f6-e677287563d4.sql
20260416120607_ab4110db-aa60-4c35-bde9-c69acce08ea8.sql
20260416121800_9b614ff9-4307-435f-a8cb-b4b8d08d8cbd.sql
20260416134010_4b3e14a5-75b4-4628-9180-f9b19ae17bac.sql
20260416135347_e77e597a-bb1e-4eab-8ef1-01fa7b585765.sql
20260416140045_9db6d984-5f46-40e3-aa2f-bd47b6d7baf1.sql
20260416140823_9d7f4163-bc89-4588-a4c3-93b3e860216f.sql
20260416141818_00611dfb-0185-409d-92e1-6a24d83fff2b.sql
20260416142324_9f73115f-7cbd-4de4-aa84-de6eba183a25.sql
20260416143729_f48f6980-64fb-4d0b-92de-4612588d718b.sql
20260416144329_726c7a95-1668-4c42-a1bb-e14f621f7099.sql
20260416165043_5c90a699-b920-4849-ad83-9d9512955be1.sql
20260416184716_25da87fa-dbca-4601-902b-e5f5b084b4ba.sql
20260416200704_05590287-5653-4c9a-8478-d7d306fe009f.sql
20260417104501_21a0b9c9-78ff-4925-92c9-71b2d0a04784.sql
20260417105824_d1cc59ae-51e2-4a27-a7b7-8deaa41b9c84.sql
20260417112255_b50403e4-09cc-4834-a585-aa4d54a6fe54.sql
20260417123534_ecc9b6eb-5a00-4b02-b3e1-425c33bd7141.sql
20260417131240_d1047c68-bae5-4028-8de7-4a6939c82ce0.sql
20260417132755_f721aef1-13df-4f7a-9ace-dcb49205f77f.sql
20260417145909_83f3aecc-a945-47d2-99b7-ac50a9e9998e.sql
20260417152744_284092f8-eb27-4da3-9da4-bc07830d0c3f.sql
20260417163417_0d86ad48-4abb-449d-a357-2bd6de2a86ef.sql
20260420111238_355660ef-9c1a-4a33-bc5b-21203e89fe69.sql
20260420113733_33fd0574-eede-4416-9d7f-df328ab4153e.sql
20260420114604_f960e530-92bc-45dc-8d07-6b74b357ef82.sql
20260420114854_834f6847-223c-46ac-8ebb-8f40b3620c05.sql
20260420130403_412c2369-375b-4fed-bd54-efe630dd51bc.sql
20260420135245_3f5c2b21-fb5f-418e-ace7-a607e0309cd5.sql
20260501000000_buyer_recommendation_cache.sql
20260501000001_remarketing_buyers_seeding_columns.sql
20260501000002_buyer_seed_log.sql
20260501000003_buyer_seed_cache.sql
20260501100000_drop_dead_listing_columns.sql
20260502000000_test_run_tracking.sql
20260502100000_buyer_recommendation_hardening.sql
20260503000000_drop_unused_tables.sql
20260503100000_clear_buyer_recommendation_caches.sql
20260504000000_fix_deals_rpc_connection_request_filter.sql
20260505000000_clay_enrichment_requests.sql
20260506000000_fix_buyer_introductions_rls.sql
20260506100000_migrate_deal_contact_fields.sql
20260506200000_drop_deal_pipeline_duplicate_columns.sql
20260506300000_drop_dead_listings_columns.sql
20260507000000_add_score_snapshot_to_buyer_introductions.sql
20260508000000_add_deal_task_types.sql
20260509000000_update_introduction_status_workflow.sql
20260510000000_backfill_pe_firm_ids.sql
20260511000000_add_remarketing_buyer_id_to_introductions.sql
20260512000000_buyer_contact_at_signup.sql
20260513000000_add_assignee_rls_policy_standup_tasks.sql
20260514000000_rename_remarketing_buyers_to_buyers.sql
20260515000000_add_need_to_show_deal_status.sql
20260515000001_add_publicly_traded_flag.sql
20260515100000_drop_dead_listing_columns.sql
20260515200000_optimize_active_deals_query.sql
20260516000000_add_sourceco_to_dashboard_stats.sql
20260516100000_global_rate_limiter.sql
20260516200000_buyer_single_source_of_truth.sql
20260516300000_replace_trigger_chains_with_rpcs.sql
20260516400000_event_driven_architecture.sql
20260516500000_analytics_consolidation.sql
20260517000000_seed_industry_calculator_leads.sql
20260517100000_prevent_duplicate_buyers.sql
20260517200000_merge_duplicate_buyers.sql
20260517300000_require_buyer_website.sql
20260518000000_buyer_relationship_system.sql
20260519000000_drop_dead_columns.sql
20260520000000_add_similarity_search_rpcs.sql
20260521000000_schedule_pe_backfill_cron.sql
20260522000000_restore_listing_notes.sql
20260523000000_critical_security_fixes.sql
20260523000001_high_severity_fixes.sql
20260523000002_medium_severity_fixes.sql
20260524000000_add_deal_sources_array.sql
20260525000000_platform_audit_remediation.sql
20260526000000_buyer_enrichment_queue_add_paused_status.sql
20260527000000_reactivate_pipeline_stages.sql
20260528000000_add_calendar_url_to_profiles.sql
20260529000000_source_deal_id_cascade.sql
20260530000000_buyer_outreach_tables.sql
20260601000000_buyer_discovery_feedback.sql
20260602000000_buyer_seed_log_add_profile_columns.sql
20260602000001_relax_website_constraint_for_pe_firms.sql
20260603000000_contact_discovery_log.sql
20260604000000_drop_buyer_type_profiles.sql
20260605000000_ds_meeting_filter_and_cleanup.sql
20260605000001_standardize_existing_task_titles.sql
20260606000000_cleanup_non_deal_tasks.sql
20260607000000_add_featured_deal_ids.sql
20260607000001_drop_docuseal_dead_code.sql
20260608000000_add_under_loi_flag.sql
20260609000000_align_profiles_buyer_type_constraint.sql
20260610000000_add_data_room_text_content.sql
20260611000000_fix_contact_list_members_trigger.sql
20260613000000_upsert_buyer_contact.sql
20260614000000_add_hired_broker_to_listings.sql
20260614000001_add_archive_reason_to_listings.sql
20260615000000_consolidate_agreement_status.sql
20260616000000_pipeline_introduction_fixes.sql
20260617000000_client_portal_tables.sql
20260617000001_outlook_email_audit_fixes.sql
20260617100000_add_portal_source_to_constraints.sql
20260618000000_portal_enhancements.sql
20260619000000_comprehensive_workflow_automation.sql
20260619000001_remaining_workflow_gaps.sql
20260620000000_add_additional_phone_numbers.sql
20260620000001_bulk_update_connection_request_status.sql
20260621000000_captarget_performance_indexes.sql
20260622000000_portal_access_rpc.sql
20260623000000_portal_security_fixes.sql
20260624000000_portal_cleanup_unused_response_types.sql
20260625000000_deal_pipeline_close_capture.sql
20260625000000_freeze_shared_utilities.sql
20260625000001_deal_pipeline_stage_flag_sync.sql
20260625000001_idempotent_chat_and_analytics_indexes.sql
20260625000002_consolidate_admin_view_state.sql
20260625000003_merge_audit_log_into_audit_logs.sql
20260625000004_extend_contacts_schema.sql
20260625000005_create_contact_events.sql
20260625000006_contacts_upsert_rpc.sql
20260625000007_drop_remarketing_buyer_contacts.sql
20260625000008_revoke_direct_contacts_writes.sql
20260625000009_drop_enriched_contacts.sql
20260626000000_pipeline_deep_dive_fixes.sql
20260626000001_create_deal_from_introduction_rpc.sql
20260626000002_deal_pipeline_rls_hardening.sql
20260627000000_pipeline_crm_completeness.sql
20260628000000_fix_task_templates_buyside.sql
20260628000001_pipeline_scenario_gap_fixes.sql
20260628000002_listing_level_deal_alerts.sql
```
