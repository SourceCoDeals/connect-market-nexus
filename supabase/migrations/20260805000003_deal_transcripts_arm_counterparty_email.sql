-- =============================================================================
-- unified_contact_timeline.deal_transcripts arm: populate counterparty contact_email
-- =============================================================================
-- Audit finding UC #20: the deal_transcripts arm added by 20260805000001 sets
-- contact_email = NULL on every row. get_firm_activity's WHERE clause matches
-- via remarketing_buyer_id OR domain-of-contact_email. Both are NULL on the
-- new arm, so seller-side meetings never surface in buyer profile timelines
-- via get_firm_activity (despite being correctly stored in deal_transcripts
-- and visible on the deal page).
--
-- Coverage analysis (2026-04-27, 731 rows in deal_transcripts):
--   - contact_id populated:    87 rows (12%)  — too sparse to be primary
--   - meeting_attendees set:  412 rows (56%)  — text[] of plain emails
--   - participants JSON set:  451 rows (62%)  — array of {email, name, ...}
--
-- Fix: populate contact_email from a coalesce chain:
--   1. The contact_id-linked contact's email, if contact_id is set.
--   2. Else the first counterparty email in meeting_attendees (filter out
--      internal sourcecodeals.com domain).
--   3. Else the first counterparty email in participants[].email (same filter).
--   4. Else NULL.
--
-- Internal-domain filter: hardcoded `sourcecodeals.com` for now. If multiple
-- internal domains emerge later, extend to a `internal_email_domains` lookup.
-- The filter is necessary because counterparty matching depends on the
-- COUNTERPARTY's domain, not the team member's domain.
--
-- This migration uses CREATE OR REPLACE VIEW: arms 1–6 reproduced verbatim
-- from 20260805000001 (which itself was verbatim from the live dump). Only
-- arm 7's contact_email expression changes.
-- =============================================================================

CREATE OR REPLACE VIEW public.unified_contact_timeline AS

-- 1. PhoneBurner call activities (verbatim)
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

-- 7. Seller-side transcripts — UPDATED: contact_email populated from
--    counterparty (first non-internal email in meeting_attendees / participants).
 SELECT "dt"."id",
    "dt"."contact_id",
    NULL::"uuid" AS "remarketing_buyer_id",
    -- Counterparty email coalesce chain:
    --   1. contact's email if contact_id is set
    --   2. first non-sourcecodeals.com address in meeting_attendees[]
    --   3. first non-sourcecodeals.com address in participants[].email
    --   4. NULL
    COALESCE(
        ( SELECT lower("c"."email")
            FROM "public"."contacts" "c"
            WHERE "c"."id" = "dt"."contact_id"
              AND "c"."email" IS NOT NULL
            LIMIT 1 ),
        ( SELECT lower("attendee")
            FROM unnest(COALESCE("dt"."meeting_attendees", ARRAY[]::"text"[])) AS "attendee"
            WHERE "attendee" IS NOT NULL
              AND "attendee" <> ''
              AND position('@' IN "attendee") > 0
              AND lower(split_part("attendee", '@', 2)) <> 'sourcecodeals.com'
            LIMIT 1 ),
        ( SELECT lower("p"->>'email')
            FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof("dt"."participants") = 'array'
                     THEN "dt"."participants"
                     ELSE '[]'::jsonb
                END
            ) AS "p"
            WHERE "p"->>'email' IS NOT NULL
              AND "p"->>'email' <> ''
              AND position('@' IN "p"->>'email') > 0
              AND lower(split_part("p"->>'email', '@', 2)) <> 'sourcecodeals.com'
            LIMIT 1 )
    ) AS "contact_email",
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
    ( SELECT TRIM(BOTH FROM "concat_ws"(' '::"text", "p"."first_name", "p"."last_name")) AS "btrim"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "dt"."created_by")) AS "team_member_name"
   FROM "public"."deal_transcripts" "dt"
   WHERE "dt"."has_content" IS NOT FALSE;

-- Re-apply security_invoker (preserved by CREATE OR REPLACE VIEW but defensive).
ALTER VIEW public.unified_contact_timeline SET (security_invoker = true);

-- get_firm_activity and get_firm_touchpoint_counts continue to work unchanged
-- (CREATE OR REPLACE VIEW preserves the row type).
