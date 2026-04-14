-- =============================================================================
-- Track text extraction errors on data_room_documents
-- =============================================================================
-- When extractTextFromDocument fails for a specific document (unsupported
-- format, file too large, Gemini API error, corrupt ZIP, etc.) we need a
-- place to record WHY so operators can see which documents are missing from
-- enrichment and why.
--
-- Without this column, failures were silent — text_content stayed NULL and
-- the enrichment pipeline treated those docs as "no content available",
-- which is indistinguishable from "not yet processed".
-- =============================================================================

ALTER TABLE public.data_room_documents
  ADD COLUMN IF NOT EXISTS text_extraction_error TEXT;

COMMENT ON COLUMN public.data_room_documents.text_extraction_error IS
  'Last error message from text extraction (extractAndStoreDocumentText). '
  'NULL if extraction succeeded or has not been attempted. Non-NULL means '
  'extraction failed and text_content will also be NULL.';

-- Partial index so operators can cheaply find documents that need
-- re-extraction (or manual inspection).
CREATE INDEX IF NOT EXISTS idx_data_room_documents_extraction_error
  ON public.data_room_documents(deal_id, created_at DESC)
  WHERE text_extraction_error IS NOT NULL;
