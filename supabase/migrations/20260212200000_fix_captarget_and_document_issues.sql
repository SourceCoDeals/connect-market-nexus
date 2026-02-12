-- Fix audit issues across CapTarget integration and M&A document system

-- 1. Fix captarget_sync_log: add INSERT policy so the cron/service-role can write logs
CREATE POLICY "Service role can insert captarget sync logs"
  ON public.captarget_sync_log FOR INSERT
  WITH CHECK (true);

-- 2. Expand universe-documents bucket to accept common document formats
-- (.docx, .doc, .xlsx, .xls, .csv were rejected despite frontend accepting them)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'text/html',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
]
WHERE id = 'universe-documents';
