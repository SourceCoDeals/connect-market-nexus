-- ============================================================================
-- DocuSeal E-Signature Integration
--
-- Adds:
--   1. DocuSeal tracking columns on firm_agreements (additive only)
--   2. docuseal_webhook_log table for audit/legal compliance
--   3. Indexes for efficient lookups
--
-- IMPORTANT: Existing firm_agreements columns (nda_signed, fee_agreement_signed,
-- etc.) are preserved. The webhook handler sets BOTH the new DocuSeal fields
-- AND the existing booleans so all current queries keep working.
-- ============================================================================

-- ─── 1. Add DocuSeal columns to firm_agreements ───

ALTER TABLE firm_agreements ADD COLUMN IF NOT EXISTS nda_docuseal_submission_id TEXT;
ALTER TABLE firm_agreements ADD COLUMN IF NOT EXISTS nda_docuseal_status TEXT DEFAULT 'not_sent';
ALTER TABLE firm_agreements ADD COLUMN IF NOT EXISTS nda_signed_document_url TEXT;
ALTER TABLE firm_agreements ADD COLUMN IF NOT EXISTS fee_docuseal_submission_id TEXT;
ALTER TABLE firm_agreements ADD COLUMN IF NOT EXISTS fee_docuseal_status TEXT DEFAULT 'not_sent';
ALTER TABLE firm_agreements ADD COLUMN IF NOT EXISTS fee_signed_document_url TEXT;

-- ─── 2. Create webhook audit log ───

CREATE TABLE IF NOT EXISTS public.docuseal_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  submitter_id TEXT,
  external_id TEXT,
  document_type TEXT,
  raw_payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docuseal_webhook_external_id
  ON public.docuseal_webhook_log(external_id);
CREATE INDEX IF NOT EXISTS idx_docuseal_webhook_submission_id
  ON public.docuseal_webhook_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_docuseal_webhook_created_at
  ON public.docuseal_webhook_log(created_at DESC);

COMMENT ON TABLE public.docuseal_webhook_log IS
  'Immutable audit log for all DocuSeal webhook events. '
  'Every event (form.completed, form.viewed, form.started, form.declined) '
  'is logged here with the full raw payload for legal compliance.';

-- ─── 3. RLS ───

ALTER TABLE public.docuseal_webhook_log ENABLE ROW LEVEL SECURITY;

-- Admin read access
DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.docuseal_webhook_log;
CREATE POLICY "Admins can view webhook logs"
  ON public.docuseal_webhook_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Service role insert (from edge functions)
DROP POLICY IF EXISTS "Service role can insert webhook logs" ON public.docuseal_webhook_log;
CREATE POLICY "Service role can insert webhook logs"
  ON public.docuseal_webhook_log
  FOR INSERT TO service_role
  WITH CHECK (true);

-- ─── 4. Grants ───

GRANT SELECT ON public.docuseal_webhook_log TO authenticated;
GRANT ALL ON public.docuseal_webhook_log TO service_role;

-- ============================================================================
-- Summary:
--   6 new columns on firm_agreements (all nullable/defaulted, fully additive)
--   1 new table: docuseal_webhook_log
--   RLS: Admin read, service_role insert
-- ============================================================================
