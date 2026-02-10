-- Global Activity Queue: Unified AI operations manager
-- Coordinates concurrency across deal enrichment, buyer enrichment, guide generation, and scoring

CREATE TABLE public.global_activity_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL
    CHECK (operation_type IN (
      'deal_enrichment', 'buyer_enrichment', 'guide_generation',
      'buyer_scoring', 'criteria_extraction')),
  classification TEXT NOT NULL DEFAULT 'major'
    CHECK (classification IN ('major', 'minor')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  context_json JSONB DEFAULT '{}',
  error_log JSONB DEFAULT '[]',
  started_by UUID REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  queued_at TIMESTAMPTZ DEFAULT now(),
  queue_position INTEGER,
  -- Description shown in UI (e.g. "Enriching 50 deals from Universe X")
  description TEXT
);

-- Fast lookup for active/queued operations
CREATE INDEX idx_gaq_status ON public.global_activity_queue(status);
CREATE INDEX idx_gaq_classification_status
  ON public.global_activity_queue(classification, status);
-- For history page ordering
CREATE INDEX idx_gaq_completed_at ON public.global_activity_queue(completed_at DESC)
  WHERE completed_at IS NOT NULL;
-- For queue ordering
CREATE INDEX idx_gaq_queued_at ON public.global_activity_queue(queued_at ASC)
  WHERE status = 'queued';

ALTER TABLE public.global_activity_queue ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (for status bar visibility)
CREATE POLICY "Authenticated users can view activity queue"
  ON public.global_activity_queue FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage activity queue"
  ON public.global_activity_queue FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true));

-- Enable realtime for live status bar updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_activity_queue;

COMMENT ON TABLE public.global_activity_queue IS
  'Central orchestration table for all AI operations. Enforces one major operation at a time.';
