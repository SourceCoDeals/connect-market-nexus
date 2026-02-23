-- Fix: Make listing_id nullable for non-deal chat contexts (buyers, deals, universe)
ALTER TABLE public.chat_conversations ALTER COLUMN listing_id DROP NOT NULL;