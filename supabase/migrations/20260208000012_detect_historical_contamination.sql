-- Phase 2: Historical Contamination Detection and Flagging
-- Identifies buyers with potential provenance violations that occurred before enforcement

-- 1. Add data quality flags column if not exists
ALTER TABLE remarketing_buyers
ADD COLUMN IF NOT EXISTS data_quality_flags JSONB DEFAULT '{}';

COMMENT ON COLUMN remarketing_buyers.data_quality_flags IS 'Data quality warnings and flags for manual review. E.g., {"contamination_risk": "high", "reason": "PE→Platform field mixing"}';

-- 2. Create function to detect PE→Platform contamination
CREATE OR REPLACE FUNCTION detect_pe_platform_contamination()
RETURNS TABLE (
  buyer_id UUID,
  company_name TEXT,
  pe_firm_name TEXT,
  contamination_type TEXT,
  suspicious_fields TEXT[],
  risk_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as buyer_id,
    b.company_name,
    b.pe_firm_name,
    'pe_to_platform'::TEXT as contamination_type,
    ARRAY_AGG(
      CASE
        WHEN b.business_summary IS NOT NULL THEN 'business_summary'
        WHEN b.services_offered IS NOT NULL THEN 'services_offered'
        WHEN b.industry_vertical IS NOT NULL THEN 'industry_vertical'
        WHEN b.specialized_focus IS NOT NULL THEN 'specialized_focus'
        WHEN b.business_type IS NOT NULL THEN 'business_type'
        ELSE NULL
      END
    ) FILTER (WHERE
      b.business_summary IS NOT NULL OR
      b.services_offered IS NOT NULL OR
      b.industry_vertical IS NOT NULL OR
      b.specialized_focus IS NOT NULL OR
      b.business_type IS NOT NULL
    ) as suspicious_fields,
    CASE
      WHEN (b.business_summary IS NOT NULL AND b.services_offered IS NOT NULL) THEN 'high'
      WHEN (b.business_summary IS NOT NULL OR b.services_offered IS NOT NULL) THEN 'medium'
      ELSE 'low'
    END::TEXT as risk_level
  FROM remarketing_buyers b
  WHERE
    b.pe_firm_name IS NOT NULL
    AND b.pe_firm_name != ''
    AND (
      b.business_summary IS NOT NULL OR
      b.services_offered IS NOT NULL OR
      b.industry_vertical IS NOT NULL OR
      b.specialized_focus IS NOT NULL OR
      b.business_type IS NOT NULL
    )
    -- No transcript source that would legitimately provide this data
    AND NOT EXISTS (
      SELECT 1 FROM unnest(b.extraction_sources) AS src
      WHERE (src->>'type')::text IN ('transcript', 'buyer_transcript')
    )
    AND b.archived = false
  GROUP BY b.id, b.company_name, b.pe_firm_name, b.business_summary, b.services_offered;
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to detect Platform→PE contamination
CREATE OR REPLACE FUNCTION detect_platform_pe_contamination()
RETURNS TABLE (
  buyer_id UUID,
  company_name TEXT,
  contamination_type TEXT,
  suspicious_fields TEXT[],
  risk_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as buyer_id,
    b.company_name,
    'platform_to_pe'::TEXT as contamination_type,
    ARRAY_AGG(
      CASE
        WHEN b.target_revenue_min IS NOT NULL THEN 'target_revenue_min'
        WHEN b.target_ebitda_min IS NOT NULL THEN 'target_ebitda_min'
        WHEN b.num_platforms IS NOT NULL THEN 'num_platforms'
        ELSE NULL
      END
    ) FILTER (WHERE
      b.target_revenue_min IS NOT NULL OR
      b.target_ebitda_min IS NOT NULL OR
      b.num_platforms IS NOT NULL
    ) as suspicious_fields,
    CASE
      WHEN (b.target_revenue_min IS NOT NULL AND b.target_ebitda_min IS NOT NULL) THEN 'high'
      WHEN (b.target_revenue_min IS NOT NULL OR b.target_ebitda_min IS NOT NULL) THEN 'medium'
      ELSE 'low'
    END::TEXT as risk_level
  FROM remarketing_buyers b
  WHERE
    (b.pe_firm_name IS NULL OR b.pe_firm_name = '')
    AND b.buyer_type = 'platform'
    AND (
      b.target_revenue_min IS NOT NULL OR
      b.target_ebitda_min IS NOT NULL OR
      b.num_platforms IS NOT NULL
    )
    -- No transcript source that would legitimately provide this data
    AND NOT EXISTS (
      SELECT 1 FROM unnest(b.extraction_sources) AS src
      WHERE (src->>'type')::text IN ('transcript', 'buyer_transcript')
    )
    AND b.archived = false
  GROUP BY b.id, b.company_name, b.target_revenue_min, b.target_ebitda_min, b.num_platforms;
END;
$$ LANGUAGE plpgsql;

-- 4. Flag PE→Platform contamination cases
DO $$
DECLARE
  contaminated_record RECORD;
  flagged_count INTEGER := 0;
BEGIN
  FOR contaminated_record IN SELECT * FROM detect_pe_platform_contamination() LOOP
    UPDATE remarketing_buyers
    SET
      data_quality_flags = data_quality_flags || jsonb_build_object(
        'contamination_detected', true,
        'contamination_type', contaminated_record.contamination_type,
        'risk_level', contaminated_record.risk_level,
        'suspicious_fields', contaminated_record.suspicious_fields,
        'reason', 'PE firm has platform-owned fields (business_summary, services) without transcript source. May be historical contamination from PE firm website scraping.',
        'detected_at', now(),
        'action_required', 'manual_review',
        'suggestion', 'Review these fields. If data came from PE firm website, consider clearing business_summary/services_offered or obtaining buyer transcript to validate.'
      ),
      -- Reduce data_completeness score by 20 points for contaminated records
      data_completeness = GREATEST(0, COALESCE(data_completeness, 0) - 20)
    WHERE id = contaminated_record.buyer_id;

    flagged_count := flagged_count + 1;
  END LOOP;

  RAISE NOTICE 'Flagged % records with PE→Platform contamination', flagged_count;
END $$;

-- 5. Flag Platform→PE contamination cases
DO $$
DECLARE
  contaminated_record RECORD;
  flagged_count INTEGER := 0;
BEGIN
  FOR contaminated_record IN SELECT * FROM detect_platform_pe_contamination() LOOP
    UPDATE remarketing_buyers
    SET
      data_quality_flags = data_quality_flags || jsonb_build_object(
        'contamination_detected', true,
        'contamination_type', contaminated_record.contamination_type,
        'risk_level', contaminated_record.risk_level,
        'suspicious_fields', contaminated_record.suspicious_fields,
        'reason', 'Platform company has PE-specific fields (revenue/EBITDA criteria) without transcript source. May be misclassified or historical data entry error.',
        'detected_at', now(),
        'action_required', 'manual_review',
        'suggestion', 'Verify buyer_type. If actually a PE-backed platform, set pe_firm_name. If strategic, obtain transcript to validate investment criteria or clear these fields.'
      ),
      -- Reduce data_completeness score by 20 points for contaminated records
      data_completeness = GREATEST(0, COALESCE(data_completeness, 0) - 20)
    WHERE id = contaminated_record.buyer_id;

    flagged_count := flagged_count + 1;
  END LOOP;

  RAISE NOTICE 'Flagged % records with Platform→PE contamination', flagged_count;
END $$;

-- 6. Create view for contaminated buyers (for easy review)
CREATE OR REPLACE VIEW contaminated_buyers_view AS
SELECT
  b.id,
  b.company_name,
  b.pe_firm_name,
  b.buyer_type,
  b.data_quality_flags->>'contamination_type' as contamination_type,
  b.data_quality_flags->>'risk_level' as risk_level,
  b.data_quality_flags->>'suspicious_fields' as suspicious_fields,
  b.data_quality_flags->>'reason' as reason,
  b.data_quality_flags->>'suggestion' as suggestion,
  b.data_completeness,
  b.extraction_sources,
  b.data_last_updated
FROM remarketing_buyers b
WHERE (b.data_quality_flags->>'contamination_detected')::boolean = true
ORDER BY
  CASE b.data_quality_flags->>'risk_level'
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    ELSE 3
  END,
  b.data_last_updated DESC;

COMMENT ON VIEW contaminated_buyers_view IS 'List of buyers with detected data contamination (PE↔Platform field mixing). Prioritized by risk level.';

-- 7. Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_buyers_contamination_flag
ON remarketing_buyers ((data_quality_flags->>'contamination_detected'))
WHERE (data_quality_flags->>'contamination_detected')::boolean = true;

-- Example queries:

-- View all contaminated buyers
-- SELECT * FROM contaminated_buyers_view;

-- Count by risk level
-- SELECT
--   data_quality_flags->>'risk_level' as risk_level,
--   COUNT(*) as count
-- FROM remarketing_buyers
-- WHERE (data_quality_flags->>'contamination_detected')::boolean = true
-- GROUP BY risk_level
-- ORDER BY risk_level;

-- High-risk cases only
-- SELECT * FROM contaminated_buyers_view WHERE risk_level = 'high';
