-- Schedule the MA guide queue processor to run every minute
SELECT cron.schedule(
  'process-ma-guide-queue',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/process-ma-guide-queue',
      headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemlwcWFya21tZnVxYWRlZmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTcxMTMsImV4cCI6MjA2MjE5MzExM30.M653TuQcthJx8vZW4jPkUTdB67D_Dm48ItLcu_XBh2g"}'::jsonb,
      body := concat('{"triggered_at": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);