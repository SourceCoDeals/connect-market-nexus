
-- Migration: docuseal_webhook_contact_fk
-- Adds contact_id to docuseal_webhook_log for direct signer queries

-- 1. Add contact_id column
ALTER TABLE public.docuseal_webhook_log
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- 2. Performance index
CREATE INDEX IF NOT EXISTS idx_docuseal_webhook_contact
  ON public.docuseal_webhook_log(contact_id)
  WHERE contact_id IS NOT NULL;

-- 3. Backfill: match signer email from raw_payload to contacts
UPDATE public.docuseal_webhook_log dwl
SET contact_id = c.id
FROM public.contacts c
WHERE dwl.contact_id IS NULL
  AND dwl.raw_payload IS NOT NULL
  AND c.email IS NOT NULL
  AND lower(c.email) = lower(dwl.raw_payload->>'email')
  AND c.archived = false;
