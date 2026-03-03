-- Add missing foreign key constraint for buyer_contact_id → contacts
ALTER TABLE public.deal_pipeline
ADD CONSTRAINT deal_pipeline_buyer_contact_id_fkey
FOREIGN KEY (buyer_contact_id) REFERENCES public.contacts(id)
ON DELETE SET NULL;