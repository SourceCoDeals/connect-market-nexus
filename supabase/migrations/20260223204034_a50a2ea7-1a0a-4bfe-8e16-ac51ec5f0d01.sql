
-- Enable pgvector extension for semantic transcript search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add embedding column to buyer_transcripts
ALTER TABLE public.buyer_transcripts
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add embedding column to deal_transcripts  
ALTER TABLE public.deal_transcripts
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_buyer_transcripts_embedding 
ON public.buyer_transcripts 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_deal_transcripts_embedding 
ON public.deal_transcripts 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Create a function for semantic search across transcripts
CREATE OR REPLACE FUNCTION public.search_transcripts_semantic(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  p_buyer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_type text,
  buyer_id uuid,
  title text,
  transcript_snippet text,
  similarity float,
  call_date timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id,
    'buyer_transcript'::text as source_type,
    bt.buyer_id,
    bt.title,
    LEFT(bt.transcript_text, 500) as transcript_snippet,
    1 - (bt.embedding <=> query_embedding) as similarity,
    bt.call_date::timestamptz,
    bt.created_at
  FROM buyer_transcripts bt
  WHERE bt.embedding IS NOT NULL
    AND 1 - (bt.embedding <=> query_embedding) > match_threshold
    AND (p_buyer_id IS NULL OR bt.buyer_id = p_buyer_id)
  
  UNION ALL
  
  SELECT 
    dt.id,
    'deal_transcript'::text as source_type,
    NULL::uuid as buyer_id,
    dt.title,
    LEFT(dt.transcript_text, 500) as transcript_snippet,
    1 - (dt.embedding <=> query_embedding) as similarity,
    dt.call_date::timestamptz,
    dt.created_at
  FROM deal_transcripts dt
  WHERE dt.embedding IS NOT NULL
    AND 1 - (dt.embedding <=> query_embedding) > match_threshold
  
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
