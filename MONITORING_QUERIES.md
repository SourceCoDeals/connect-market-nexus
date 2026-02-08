# Data Integrity Monitoring Queries

**Purpose:** Track provenance violations, contamination, and enrichment health in production.

**Date:** 2026-02-08

---

## 1. Provenance Violations (Real-Time)

### Find Recent Provenance Blocks
```sql
-- Shows fields that were blocked by provenance rules in last 24 hours
SELECT
  e.buyer_id,
  b.company_name,
  e.event_type,
  e.source_type,
  e.fields_blocked,
  e.block_reasons,
  e.created_at
FROM enrichment_event_log e
JOIN remarketing_buyers b ON e.buyer_id = b.id
WHERE array_length(e.fields_blocked, 1) > 0
  AND e.created_at > now() - interval '24 hours'
ORDER BY e.created_at DESC
LIMIT 50;
```

### Provenance Block Frequency by Source
```sql
-- Which sources are attempting to write to protected fields most often?
SELECT
  source_type,
  COUNT(*) as block_events,
  COUNT(DISTINCT buyer_id) as buyers_affected,
  array_agg(DISTINCT unnest(fields_blocked)) as commonly_blocked_fields
FROM enrichment_event_log
WHERE array_length(fields_blocked, 1) > 0
  AND created_at > now() - interval '7 days'
GROUP BY source_type
ORDER BY block_events DESC;
```

---

## 2. Transcript Protection (Real-Time)

### Transcript-Protected Fields Being Skipped
```sql
-- Shows when lower-priority sources tried to overwrite transcript data
SELECT
  e.buyer_id,
  b.company_name,
  e.source_type,
  e.fields_skipped,
  e.created_at
FROM enrichment_event_log e
JOIN remarketing_buyers b ON e.buyer_id = b.id
WHERE array_length(e.fields_skipped, 1) > 0
  AND e.source_type NOT IN ('transcript', 'buyer_transcript')
  AND e.created_at > now() - interval '7 days'
ORDER BY e.created_at DESC
LIMIT 50;
```

### Buyers with Most Transcript Protection Events
```sql
-- Which buyers are frequently being protected from overwrites?
SELECT
  buyer_id,
  MAX(b.company_name) as company_name,
  COUNT(*) as protection_events,
  array_agg(DISTINCT unnest(fields_skipped)) as protected_fields
FROM enrichment_event_log e
JOIN remarketing_buyers b ON e.buyer_id = b.id
WHERE array_length(fields_skipped, 1) > 0
  AND created_at > now() - interval '30 days'
GROUP BY buyer_id
HAVING COUNT(*) > 3
ORDER BY protection_events DESC
LIMIT 20;
```

---

## 3. Concurrency Issues

### Recent Lock Conflicts
```sql
-- Enrichment operations that failed due to concurrent locks
SELECT
  e.buyer_id,
  b.company_name,
  e.event_type,
  e.source_type,
  e.created_at,
  e.error_message
FROM enrichment_event_log e
JOIN remarketing_buyers b ON e.buyer_id = b.id
WHERE e.lock_conflict = true
  AND e.created_at > now() - interval '24 hours'
ORDER BY e.created_at DESC;
```

### Buyers with Frequent Lock Conflicts
```sql
-- Buyers that are "hot" (high concurrent activity)
SELECT
  buyer_id,
  MAX(b.company_name) as company_name,
  COUNT(*) as conflict_count,
  array_agg(DISTINCT event_type) as conflicting_operations
FROM enrichment_event_log e
JOIN remarketing_buyers b ON e.buyer_id = b.id
WHERE lock_conflict = true
  AND created_at > now() - interval '7 days'
GROUP BY buyer_id
HAVING COUNT(*) > 2
ORDER BY conflict_count DESC;
```

---

## 4. Historical Contamination Detection

### Potential PE→Platform Field Contamination
```sql
-- Buyers with PE firm name but also have platform-owned fields WITHOUT transcript source
-- This indicates historical contamination that occurred before provenance was enforced
SELECT
  id,
  company_name,
  pe_firm_name,
  business_summary IS NOT NULL as has_business_summary,
  services_offered IS NOT NULL as has_services,
  industry_vertical IS NOT NULL as has_industry,
  extraction_sources,
  data_last_updated
FROM remarketing_buyers
WHERE
  pe_firm_name IS NOT NULL
  AND pe_firm_name != ''
  AND (
    business_summary IS NOT NULL OR
    services_offered IS NOT NULL OR
    industry_vertical IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM unnest(extraction_sources) AS src
    WHERE (src->>'type')::text IN ('transcript', 'buyer_transcript')
  )
ORDER BY data_last_updated DESC
LIMIT 50;
```

### Potential Platform→PE Field Contamination
```sql
-- Platform companies that have PE-specific fields (investment criteria) WITHOUT transcript source
SELECT
  id,
  company_name,
  buyer_type,
  pe_firm_name,
  target_revenue_min IS NOT NULL as has_revenue_criteria,
  target_ebitda_min IS NOT NULL as has_ebitda_criteria,
  extraction_sources,
  data_last_updated
FROM remarketing_buyers
WHERE
  (pe_firm_name IS NULL OR pe_firm_name = '')
  AND buyer_type = 'platform'
  AND (
    target_revenue_min IS NOT NULL OR
    target_ebitda_min IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM unnest(extraction_sources) AS src
    WHERE (src->>'type')::text IN ('transcript', 'buyer_transcript')
  )
ORDER BY data_last_updated DESC
LIMIT 50;
```

---

## 5. Enrichment Health Metrics

### Enrichment Success Rate (Last 7 Days)
```sql
SELECT
  event_type,
  COUNT(*) as total_events,
  ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_pct,
  ROUND(100.0 * SUM(CASE WHEN status = 'partial_success' THEN 1 ELSE 0 END) / COUNT(*), 1) as partial_pct,
  ROUND(100.0 * SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) / COUNT(*), 1) as blocked_pct,
  ROUND(100.0 * SUM(CASE WHEN status = 'lock_conflict' THEN 1 ELSE 0 END) / COUNT(*), 1) as conflict_pct,
  ROUND(100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 1) as failed_pct
FROM enrichment_event_log
WHERE created_at > now() - interval '7 days'
GROUP BY event_type
ORDER BY total_events DESC;
```

### Average Enrichment Duration by Type
```sql
SELECT
  event_type,
  COUNT(*) as events,
  ROUND(AVG(duration_ms)::numeric, 0) as avg_duration_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric, 0) as median_duration_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 0) as p95_duration_ms,
  MAX(duration_ms) as max_duration_ms
FROM enrichment_event_log
WHERE duration_ms IS NOT NULL
  AND created_at > now() - interval '7 days'
GROUP BY event_type
ORDER BY avg_duration_ms DESC;
```

### Data Completeness Improvement
```sql
-- Track how much enrichment operations improve data completeness
SELECT
  event_type,
  COUNT(*) as operations,
  ROUND(AVG(data_completeness_after - data_completeness_before), 1) as avg_improvement,
  SUM(CASE WHEN data_completeness_after > data_completeness_before THEN 1 ELSE 0 END) as improved_count,
  ROUND(100.0 * SUM(CASE WHEN data_completeness_after > data_completeness_before THEN 1 ELSE 0 END) / COUNT(*), 1) as improvement_rate_pct
FROM enrichment_event_log
WHERE data_completeness_before IS NOT NULL
  AND data_completeness_after IS NOT NULL
  AND created_at > now() - interval '30 days'
GROUP BY event_type
ORDER BY avg_improvement DESC;
```

---

## 6. Scoring Data Quality

### Buyers with NULL Composite Scores (Missing Data)
```sql
-- Identifies buyers that can't be scored due to insufficient data
SELECT
  b.id,
  b.company_name,
  b.buyer_type,
  b.pe_firm_name,
  b.data_completeness,
  b.target_revenue_min IS NULL as missing_revenue,
  b.target_services IS NULL OR array_length(b.target_services, 1) = 0 as missing_services,
  b.target_geographies IS NULL OR array_length(b.target_geographies, 1) = 0 as missing_geographies,
  b.thesis_summary IS NULL as missing_thesis,
  b.data_last_updated
FROM remarketing_buyers b
WHERE
  b.archived = false
  AND (
    b.data_completeness < 30
    OR (b.target_revenue_min IS NULL AND b.target_ebitda_min IS NULL)
    OR (b.target_services IS NULL OR array_length(b.target_services, 1) = 0)
    OR (b.target_geographies IS NULL OR array_length(b.target_geographies, 1) = 0)
  )
ORDER BY b.data_completeness ASC, b.data_last_updated DESC
LIMIT 50;
```

### Scoring Failures by Dimension
```sql
-- From scoring attempts, see which dimensions fail most often
-- NOTE: This requires the scoring function to log to enrichment_event_log
SELECT
  unnest(metadata->'missing_dimensions') as dimension,
  COUNT(*) as fail_count
FROM enrichment_event_log
WHERE event_type = 'scoring'
  AND status = 'failed'
  AND metadata ? 'missing_dimensions'
  AND created_at > now() - interval '30 days'
GROUP BY dimension
ORDER BY fail_count DESC;
```

---

## 7. Dashboard KPIs

### Daily Data Integrity Health
```sql
-- Single query for dashboard showing overall health
SELECT
  date_trunc('day', created_at) as date,
  COUNT(*) as total_enrichments,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN array_length(fields_blocked, 1) > 0 THEN 1 ELSE 0 END) as had_blocks,
  SUM(CASE WHEN array_length(fields_skipped, 1) > 0 THEN 1 ELSE 0 END) as had_skips,
  SUM(CASE WHEN lock_conflict THEN 1 ELSE 0 END) as lock_conflicts,
  COUNT(DISTINCT buyer_id) as unique_buyers_updated
FROM enrichment_event_log
WHERE created_at > now() - interval '30 days'
GROUP BY date
ORDER BY date DESC;
```

### Provenance Protection Effectiveness
```sql
-- How often is provenance system preventing bad writes?
SELECT
  'Total Enrichment Events' as metric,
  COUNT(*)::text as value
FROM enrichment_event_log
WHERE created_at > now() - interval '7 days'

UNION ALL

SELECT
  'Events with Provenance Blocks' as metric,
  COUNT(*)::text
FROM enrichment_event_log
WHERE array_length(fields_blocked, 1) > 0
  AND created_at > now() - interval '7 days'

UNION ALL

SELECT
  'Events with Transcript Protection' as metric,
  COUNT(*)::text
FROM enrichment_event_log
WHERE array_length(fields_skipped, 1) > 0
  AND created_at > now() - interval '7 days'

UNION ALL

SELECT
  'Lock Conflicts Prevented' as metric,
  COUNT(*)::text
FROM enrichment_event_log
WHERE lock_conflict = true
  AND created_at > now() - interval '7 days';
```

---

## 8. Alerting Queries

### Critical: Contamination Detected
```sql
-- RUN DAILY - Alert if new contamination cases found
-- This indicates provenance rules are being bypassed
SELECT COUNT(*) as contaminated_buyers
FROM remarketing_buyers
WHERE
  pe_firm_name IS NOT NULL
  AND pe_firm_name != ''
  AND (business_summary IS NOT NULL OR services_offered IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM unnest(extraction_sources) AS src
    WHERE (src->>'type')::text IN ('transcript', 'buyer_transcript')
  )
  AND data_last_updated > now() - interval '1 day';
-- Alert if result > 0
```

### High: Enrichment Failure Rate Spike
```sql
-- RUN HOURLY - Alert if enrichment failures exceed 10%
WITH recent_stats AS (
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
  FROM enrichment_event_log
  WHERE created_at > now() - interval '1 hour'
)
SELECT
  total,
  failed,
  ROUND(100.0 * failed / NULLIF(total, 0), 1) as failure_rate_pct
FROM recent_stats
WHERE total > 10
  AND 100.0 * failed / total > 10;
-- Alert if result found
```

### Medium: Lock Conflict Rate High
```sql
-- RUN HOURLY - Alert if >5% of operations have lock conflicts
WITH recent_stats AS (
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN lock_conflict THEN 1 ELSE 0 END) as conflicts
  FROM enrichment_event_log
  WHERE created_at > now() - interval '1 hour'
)
SELECT
  total,
  conflicts,
  ROUND(100.0 * conflicts / NULLIF(total, 0), 1) as conflict_rate_pct
FROM recent_stats
WHERE total > 20
  AND 100.0 * conflicts / total > 5;
-- Alert if result found
```

---

## 9. Buyer Transcript Audit

### Transcripts Not Applied to Buyer Record
```sql
-- Transcripts that were extracted but may not have updated the buyer
SELECT
  bt.id as transcript_id,
  bt.buyer_id,
  b.company_name,
  bt.source,
  bt.created_at,
  bt.processed_at,
  bt.processing_status,
  bt.error_message
FROM buyer_transcripts bt
JOIN remarketing_buyers b ON bt.buyer_id = b.id
WHERE bt.processing_status NOT IN ('completed', 'completed_with_warnings')
  OR bt.error_message IS NOT NULL
ORDER BY bt.created_at DESC
LIMIT 50;
```

### Transcript Extraction Success Rate
```sql
SELECT
  date_trunc('day', created_at) as date,
  COUNT(*) as total_transcripts,
  SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN processing_status LIKE '%error%' THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM buyer_transcripts
WHERE created_at > now() - interval '30 days'
GROUP BY date
ORDER BY date DESC;
```

---

## Usage Notes

- **Schedule**: Run alerting queries hourly, dashboard queries daily
- **Retention**: Keep enrichment_event_log for 90 days (add cleanup job)
- **Performance**: All queries use indexes created in migration
- **Dashboard**: Display KPIs from Section 7 in real-time dashboard
- **Alerts**: Set up automated alerts for queries in Section 8

---

## Next Steps

1. Create Grafana/Metabase dashboard with these queries
2. Set up automated alerts (email/Slack) for Section 8 queries
3. Add enrichment event logging to all write functions
4. Schedule weekly review of contamination queries (Section 4)
