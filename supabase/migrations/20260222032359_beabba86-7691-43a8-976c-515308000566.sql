-- Migration 7: Drop Dead Objects Phase 2

BEGIN;

-- SECTION A: Drop Dead Functions (15)
DROP FUNCTION IF EXISTS public.get_conversation_thread(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.track_user_engagement(uuid, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.auto_categorize_feedback(text) CASCADE;
DROP FUNCTION IF EXISTS public.auto_assign_priority(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.verify_production_readiness() CASCADE;
DROP FUNCTION IF EXISTS public.get_feedback_with_user_details() CASCADE;
DROP FUNCTION IF EXISTS public.assign_feedback_to_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_password_reset_token(text) CASCADE;
DROP FUNCTION IF EXISTS public.validate_reset_token(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_engagement_analytics(text) CASCADE;
DROP FUNCTION IF EXISTS public.soft_delete_profile(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_marketplace_analytics(integer) CASCADE;
DROP FUNCTION IF EXISTS public.update_listing_notes_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.log_chat_analytics(uuid, text, text, integer, integer, integer, text, uuid, uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.update_engagement_scores() CASCADE;

-- SECTION B: Drop Dead Tables (2)
DROP TABLE IF EXISTS public.lead_sources CASCADE;
DROP TABLE IF EXISTS public.scoring_weights_history CASCADE;

-- SECTION C: Drop Dead Column (1)
ALTER TABLE public.deal_stages DROP COLUMN IF EXISTS automation_rules;

-- SECTION D: Drop Dead Regular Views (11)
DROP VIEW IF EXISTS public.feedback_analytics CASCADE;
DROP VIEW IF EXISTS public.security_summary CASCADE;
DROP VIEW IF EXISTS public.active_listings CASCADE;
DROP VIEW IF EXISTS public.active_buyers CASCADE;
DROP VIEW IF EXISTS public.active_scores CASCADE;
DROP VIEW IF EXISTS public.active_universes CASCADE;
DROP VIEW IF EXISTS public.enrichment_queue_status CASCADE;
DROP VIEW IF EXISTS public.cron_job_status CASCADE;
DROP VIEW IF EXISTS public.recent_audit_activity CASCADE;
DROP VIEW IF EXISTS public.score_override_history CASCADE;
DROP VIEW IF EXISTS public.extraction_source_audit CASCADE;

-- SECTION E: Drop Dead Materialized Views (9)
DROP MATERIALIZED VIEW IF EXISTS public.mv_deal_pipeline_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_score_tier_distribution CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_buyer_activity_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_universe_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_geography_distribution CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_enrichment_provider_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_data_freshness CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_score_distribution CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.user_engagement_analytics CASCADE;

-- SECTION F: Fix trigger function referencing dropped deals.metadata column
CREATE OR REPLACE FUNCTION public.auto_create_deal_from_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_inquiry_stage_id uuid;
  deal_source_value text;
  contact_name_value text;
  contact_email_value text;
  contact_company_value text;
  contact_phone_value text;
  contact_role_value text;
  buyer_priority_value integer;
BEGIN
  SELECT id INTO new_inquiry_stage_id
  FROM public.deal_stages
  WHERE name = 'New Inquiry'
  LIMIT 1;

  deal_source_value := CASE
    WHEN NEW.source IN ('website', 'marketplace', 'webflow', 'manual') THEN NEW.source
    ELSE 'marketplace'
  END;

  IF NEW.user_id IS NOT NULL THEN
    SELECT
      COALESCE(p.first_name || ' ' || p.last_name, p.email),
      p.email, p.company, p.phone_number, p.buyer_type,
      COALESCE(calculate_buyer_priority_score(p.buyer_type), 0)
    INTO
      contact_name_value, contact_email_value, contact_company_value,
      contact_phone_value, contact_role_value, buyer_priority_value
    FROM public.profiles p WHERE p.id = NEW.user_id;
  ELSE
    contact_name_value := NEW.lead_name;
    contact_email_value := NEW.lead_email;
    contact_company_value := NEW.lead_company;
    contact_phone_value := NEW.lead_phone;
    contact_role_value := NEW.lead_role;
    buyer_priority_value := COALESCE(NEW.buyer_priority_score, 0);
  END IF;

  INSERT INTO public.deals (
    listing_id, stage_id, connection_request_id, value, probability, source, title,
    contact_name, contact_email, contact_company, contact_phone, contact_role,
    buyer_priority_score, nda_status, fee_agreement_status, created_at, stage_entered_at
  ) VALUES (
    NEW.listing_id, new_inquiry_stage_id, NEW.id, 0, 5, deal_source_value,
    COALESCE(contact_name_value || ' - ' || (SELECT title FROM public.listings WHERE id = NEW.listing_id), 'New Deal'),
    COALESCE(contact_name_value, 'Unknown Contact'), contact_email_value,
    contact_company_value, contact_phone_value, contact_role_value, buyer_priority_value,
    CASE WHEN NEW.lead_nda_signed THEN 'signed' WHEN NEW.lead_nda_email_sent THEN 'sent' ELSE 'not_sent' END,
    CASE WHEN NEW.lead_fee_agreement_signed THEN 'signed' WHEN NEW.lead_fee_agreement_email_sent THEN 'sent' ELSE 'not_sent' END,
    NEW.created_at, NEW.created_at
  );

  RETURN NEW;
END;
$function$;

COMMIT;