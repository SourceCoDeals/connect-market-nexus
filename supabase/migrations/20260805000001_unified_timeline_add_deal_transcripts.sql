-- =============================================================================
-- unified_contact_timeline: add seller-side deal_transcripts arm
-- =============================================================================
-- Adds a 7th UNION ALL arm to the view so seller-side Fireflies meetings,
-- PhoneBurner call transcripts, and manual uploads in `deal_transcripts`
-- surface in `useContactCombinedHistory`, `get_firm_activity`, and
-- `get_firm_touchpoint_counts`. Without this arm, those buyer-/firm-scoped
-- consumers under-report seller-side activity.
--
-- ── Drift-aware rewrite (2026-04-27) ─────────────────────────────────────────
-- The live `unified_contact_timeline` view already has 18 columns (the 17
-- documented in canonical migration history + a `team_member_name` subquery
-- against `public.profiles`). The `team_member_name` column was added by
-- one of the ~172 out-of-band remote migrations captured in
-- 20260427000000_remote_schema_snapshot_2026-04-27.sql.
--
-- This migration uses `CREATE OR REPLACE VIEW` rather than DROP+CREATE
-- because the new shape preserves every existing column (PG allows adding
-- a UNION arm under CREATE OR REPLACE VIEW so long as the SELECT list
-- shape is identical). Consequence: dependent functions (get_firm_activity,
-- get_firm_touchpoint_counts) do NOT need to be dropped — their bodies
-- continue to type-check against the unchanged column list.
--
-- The 6 existing UNION arms below are reproduced verbatim from the live
-- schema dump (2026-04-27) so this migration is a true superset, not a
-- regression. Only the 7th arm is new.
-- =============================================================================

CREATE OR REPLACE VIEW public.unified_contact_timeline AS

-- 1. PhoneBurner call activities (verbatim from live schema dump)
SELECT "ca"."id",
    "ca"."contact_id",
    "ca"."remarketing_buyer_id",
    "ca"."contact_email",
    'phoneburner'::"text" AS "source",
    'call'::"text" AS "channel",
    "ca"."activity_type" AS "event_type",
    COALESCE("ca"."disposition_label", "ca"."call_outcome", 'Call'::"text") AS "title",
    "ca"."disposition_notes" AS "body_preview",
    "ca"."call_started_at" AS "event_at",
    "ca"."created_at",
    "ca"."listing_id",
    NULL::"uuid" AS "deal_id",
    NULL::"text" AS "campaign_name",
    NULL::"text" AS "campaign_id",
    "ca"."call_direction" AS "direction",
    "jsonb_build_object"('duration_seconds', "ca"."call_duration_seconds", 'talk_time_seconds', "ca"."talk_time_seconds", 'recording_url', "ca"."recording_url", 'recording_url_public', "ca"."recording_url_public", 'call_transcript', "ca"."call_transcript", 'disposition_code', "ca"."disposition_code", 'disposition_label', "ca"."disposition_label", 'disposition_notes', "ca"."disposition_notes", 'call_outcome', "ca"."call_outcome", 'call_connected', "ca"."call_connected", 'phoneburner_status', "ca"."phoneburner_status", 'contact_notes', "ca"."contact_notes", 'callback_scheduled_date', "ca"."callback_scheduled_date", 'user_name', "ca"."user_name") AS "metadata",
    ( SELECT TRIM(BOTH FROM "concat_ws"(' '::"text", "p"."first_name", "p"."last_name")) AS "btrim"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "ca"."user_id")) AS "team_member_name"
   FROM "public"."contact_activities" "ca"

UNION ALL

-- 2. Outlook emails (verbatim)
 SELECT "em"."id",
    "em"."contact_id",
    "c"."remarketing_buyer_id",
    "em"."from_address" AS "contact_email",
    'outlook'::"text" AS "source",
    'email'::"text" AS "channel",
        CASE "em"."direction"
            WHEN 'outbound'::"public"."email_direction" THEN 'EMAIL_SENT'::"text"
            ELSE 'EMAIL_RECEIVED'::"text"
        END AS "event_type",
    "em"."subject" AS "title",
    NULL::"text" AS "body_preview",
    "em"."sent_at" AS "event_at",
    "em"."created_at",
    NULL::"uuid" AS "listing_id",
    "em"."deal_id",
    NULL::"text" AS "campaign_name",
    NULL::"text" AS "campaign_id",
    ("em"."direction")::"text" AS "direction",
    "jsonb_build_object"('to_addresses', "em"."to_addresses", 'has_attachments', "em"."has_attachments", 'from_address', "em"."from_address") AS "metadata",
    ( SELECT TRIM(BOTH FROM "concat_ws"(' '::"text", "p"."first_name", "p"."last_name")) AS "btrim"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "em"."sourceco_user_id")) AS "team_member_name"
   FROM ("public"."email_messages" "em"
     LEFT JOIN "public"."contacts" "c" ON (("c"."id" = "em"."contact_id")))

UNION ALL

-- 3. SmartLead messages (verbatim)
 SELECT "sm"."id",
    "sm"."contact_id",
    "sm"."remarketing_buyer_id",
    "sm"."from_address" AS "contact_email",
    'smartlead'::"text" AS "source",
    'email'::"text" AS "channel",
    "upper"("sm"."event_type") AS "event_type",
    "sm"."subject" AS "title",
    "sm"."body_text" AS "body_preview",
    "sm"."sent_at" AS "event_at",
    "sm"."created_at",
    "sm"."listing_id",
    NULL::"uuid" AS "deal_id",
    "sc"."name" AS "campaign_name",
    ("sm"."smartlead_campaign_id")::"text" AS "campaign_id",
    "sm"."direction",
    "jsonb_build_object"('sequence_number', "sm"."sequence_number", 'lead_email', "sm"."from_address", 'smartlead_campaign_id', "sm"."smartlead_campaign_id") AS "metadata",
    NULL::"text" AS "team_member_name"
   FROM ("public"."smartlead_messages" "sm"
     LEFT JOIN "public"."smartlead_campaigns" "sc" ON (("sc"."smartlead_campaign_id" = "sm"."smartlead_campaign_id")))

UNION ALL

-- 4. SmartLead reply inbox (verbatim)
 SELECT "sri"."id",
    NULL::"uuid" AS "contact_id",
    NULL::"uuid" AS "remarketing_buyer_id",
    "sri"."to_email" AS "contact_email",
    'smartlead'::"text" AS "source",
    'email'::"text" AS "channel",
    'REPLIED'::"text" AS "event_type",
    "sri"."subject" AS "title",
    "sri"."preview_text" AS "body_preview",
    "sri"."time_replied" AS "event_at",
    "sri"."created_at",
    NULL::"uuid" AS "listing_id",
    "sri"."linked_deal_id" AS "deal_id",
    "sri"."campaign_name",
    ("sri"."campaign_id")::"text" AS "campaign_id",
    'inbound'::"text" AS "direction",
    "jsonb_build_object"('from_email', "sri"."from_email", 'classification', "sri"."ai_category", 'campaign_name', "sri"."campaign_name", 'lead_email', "sri"."sl_lead_email") AS "metadata",
    NULL::"text" AS "team_member_name"
   FROM "public"."smartlead_reply_inbox" "sri"

UNION ALL

-- 5. HeyReach messages (verbatim)
 SELECT "hm"."id",
    "hm"."contact_id",
    "hm"."remarketing_buyer_id",
    "hm"."from_address" AS "contact_email",
    'heyreach'::"text" AS "source",
    'linkedin'::"text" AS "channel",
    "upper"("hm"."event_type") AS "event_type",
    "hm"."subject" AS "title",
    "hm"."body_text" AS "body_preview",
    "hm"."sent_at" AS "event_at",
    "hm"."created_at",
    "hm"."listing_id",
    NULL::"uuid" AS "deal_id",
    "hc"."name" AS "campaign_name",
    ("hm"."heyreach_campaign_id")::"text" AS "campaign_id",
    "hm"."direction",
    "jsonb_build_object"('sequence_number', "hm"."sequence_number", 'linkedin_url', "hm"."linkedin_url", 'heyreach_campaign_id', "hm"."heyreach_campaign_id") AS "metadata",
    NULL::"text" AS "team_member_name"
   FROM ("public"."heyreach_messages" "hm"
     LEFT JOIN "public"."heyreach_campaigns" "hc" ON (("hc"."heyreach_campaign_id" = "hm"."heyreach_campaign_id")))

UNION ALL

-- 6. Fireflies meetings — buyer-side (verbatim)
 SELECT "bt"."id",
    NULL::"uuid" AS "contact_id",
    "bt"."buyer_id" AS "remarketing_buyer_id",
    NULL::"text" AS "contact_email",
    'fireflies'::"text" AS "source",
    'meeting'::"text" AS "channel",
    'MEETING_RECORDED'::"text" AS "event_type",
    "bt"."title",
    "bt"."summary" AS "body_preview",
    COALESCE("bt"."call_date", "bt"."created_at") AS "event_at",
    "bt"."created_at",
    NULL::"uuid" AS "listing_id",
    NULL::"uuid" AS "deal_id",
    NULL::"text" AS "campaign_name",
    NULL::"text" AS "campaign_id",
    NULL::"text" AS "direction",
    "jsonb_build_object"('duration_minutes', "bt"."duration_minutes", 'participants', "bt"."participants", 'transcript_url', "bt"."transcript_url", 'key_points', "bt"."key_points", 'action_items', "bt"."action_items") AS "metadata",
    NULL::"text" AS "team_member_name"
   FROM "public"."buyer_transcripts" "bt"

UNION ALL

-- 7. NEW: seller-side transcripts (Fireflies meetings on listings + PhoneBurner
--    call transcripts + manual uploads). Anchored on listing_id; remarketing_buyer_id
--    and contact_id stay NULL because deal_transcripts is deal-scoped, not buyer-scoped.
 SELECT "dt"."id",
    NULL::"uuid" AS "contact_id",
    NULL::"uuid" AS "remarketing_buyer_id",
    NULL::"text" AS "contact_email",
    CASE "dt"."source"
        WHEN 'phoneburner'::"text" THEN 'phoneburner'::"text"
        WHEN 'fireflies'::"text"   THEN 'fireflies'::"text"
        ELSE COALESCE("dt"."source", 'unknown'::"text")
    END AS "source",
    CASE "dt"."source"
        WHEN 'phoneburner'::"text" THEN 'call'::"text"
        ELSE 'meeting'::"text"
    END AS "channel",
    CASE "dt"."source"
        WHEN 'phoneburner'::"text" THEN 'CALL_TRANSCRIBED'::"text"
        ELSE 'MEETING_RECORDED'::"text"
    END AS "event_type",
    COALESCE(NULLIF("dt"."title", ''::"text"), 'Seller-side transcript'::"text") AS "title",
    LEFT("dt"."transcript_text", 500) AS "body_preview",
    COALESCE("dt"."call_date", "dt"."processed_at", "dt"."created_at") AS "event_at",
    "dt"."created_at",
    "dt"."listing_id",
    NULL::"uuid" AS "deal_id",
    NULL::"text" AS "campaign_name",
    NULL::"text" AS "campaign_id",
    NULL::"text" AS "direction",
    "jsonb_build_object"(
        'duration_minutes',    "dt"."duration_minutes",
        'match_type',          "dt"."match_type",
        'extraction_status',   "dt"."extraction_status",
        'contact_activity_id', "dt"."contact_activity_id",
        'transcript_url',      "dt"."transcript_url",
        'recording_url',       "dt"."recording_url",
        'participants',        "dt"."participants",
        'meeting_attendees',   "dt"."meeting_attendees"
    ) AS "metadata",
    -- team_member_name: best-effort from dt.created_by (may be NULL for
    -- auto-ingested rows from Fireflies/PhoneBurner where creator is a
    -- service identity rather than a profile).
    ( SELECT TRIM(BOTH FROM "concat_ws"(' '::"text", "p"."first_name", "p"."last_name")) AS "btrim"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "dt"."created_by")) AS "team_member_name"
   FROM "public"."deal_transcripts" "dt"
   WHERE "dt"."has_content" IS NOT FALSE;

-- Re-apply security_invoker just to be defensive — should already be set by
-- 20260420210000_demote_security_definer_views and preserved through
-- CREATE OR REPLACE VIEW.
ALTER VIEW public.unified_contact_timeline SET (security_invoker = true);

-- Performance index for the new arm's filter path (listing-scoped recency).
CREATE INDEX IF NOT EXISTS idx_deal_transcripts_listing_event_at
  ON public.deal_transcripts (listing_id, (COALESCE(call_date, processed_at, created_at)) DESC)
  WHERE has_content IS NOT FALSE;

-- get_firm_activity and get_firm_touchpoint_counts are intentionally NOT
-- recreated. They reference unified_contact_timeline by row-type and column
-- name only; since this migration preserves all existing columns and just
-- adds a UNION arm, both functions remain valid against the new view.
-- Their live bodies (LANGUAGE plpgsql, 500-batch ceiling, NULL guard) are
-- preserved untouched — verified against the 2026-04-27 snapshot.
