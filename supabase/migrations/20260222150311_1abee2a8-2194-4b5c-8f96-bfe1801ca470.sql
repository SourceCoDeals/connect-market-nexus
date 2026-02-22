
-- 1. Fix security definer view: linkedin_manual_review_queue
ALTER VIEW public.linkedin_manual_review_queue SET (security_invoker = on);

-- 2. Drop the overly permissive ALL policy on remarketing_outreach
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.remarketing_outreach;

-- 3. Fix mutable search_path on all 17 public functions
ALTER FUNCTION public.complete_enrichment_job SET search_path = public;
ALTER FUNCTION public.decrement_provider_concurrent SET search_path = public;
ALTER FUNCTION public.extract_domain SET search_path = public;
ALTER FUNCTION public.generate_valuation_display_name SET search_path = public;
ALTER FUNCTION public.increment_provider_concurrent SET search_path = public;
ALTER FUNCTION public.log_enrichment_event SET search_path = public;
ALTER FUNCTION public.normalize_domain SET search_path = public;
ALTER FUNCTION public.refresh_audit_materialized_views SET search_path = public;
ALTER FUNCTION public.reset_stale_concurrent_counts SET search_path = public;
ALTER FUNCTION public.restore_soft_deleted SET search_path = public;
ALTER FUNCTION public.sync_fee_agreement_to_remarketing SET search_path = public;
ALTER FUNCTION public.sync_marketplace_buyer_on_approval SET search_path = public;
ALTER FUNCTION public.update_chat_conversations_updated_at SET search_path = public;
ALTER FUNCTION public.update_enrichment_job_progress SET search_path = public;
ALTER FUNCTION public.upsert_enrichment_job SET search_path = public;
ALTER FUNCTION public.validate_listing_data SET search_path = public;
ALTER FUNCTION public.valuation_leads_dedup_check SET search_path = public;
