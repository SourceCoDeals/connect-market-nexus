-- Add criteria quality validation to ensure data integrity
-- Rejects low-quality extractions and provides actionable feedback

-- ============= QUALITY THRESHOLDS =============

-- Minimum confidence scores required for each criteria type
CREATE TABLE IF NOT EXISTS criteria_quality_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criteria_type text NOT NULL UNIQUE, -- 'size', 'service', 'geography', 'buyer_types', 'overall'
  minimum_score integer NOT NULL CHECK (minimum_score >= 0 AND minimum_score <= 100),
  recommended_score integer NOT NULL CHECK (recommended_score >= minimum_score AND recommended_score <= 100),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default thresholds
INSERT INTO criteria_quality_thresholds (criteria_type, minimum_score, recommended_score, description) VALUES
  ('overall', 30, 60, 'Overall extraction confidence - below 30% indicates insufficient buyer information in guide'),
  ('size', 20, 50, 'Size criteria confidence - revenue/EBITDA ranges or qualitative size indicators'),
  ('service', 30, 60, 'Service criteria confidence - target services and business model preferences'),
  ('geography', 20, 50, 'Geographic criteria confidence - regions, states, or coverage preferences'),
  ('buyer_types', 40, 70, 'Buyer types confidence - PE firms, platforms, strategic buyers with profiles')
ON CONFLICT (criteria_type) DO NOTHING;

COMMENT ON TABLE criteria_quality_thresholds IS
  'Defines quality thresholds for buyer criteria extraction. Minimum = hard floor, Recommended = good quality.';

-- ============= VALIDATION FUNCTION =============

/**
 * Validate buyer criteria quality
 *
 * Returns validation result with:
 * - is_valid: Whether criteria meets minimum thresholds
 * - quality_grade: 'excellent' (90+), 'good' (60-89), 'acceptable' (30-59), 'poor' (<30)
 * - issues: Array of quality issues found
 * - recommendations: Array of actionable improvement suggestions
 */
CREATE OR REPLACE FUNCTION validate_buyer_criteria_quality(
  criteria jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  overall_confidence numeric;
  size_confidence numeric;
  service_confidence numeric;
  geography_confidence numeric;
  buyer_types_confidence numeric;

  is_valid boolean := true;
  quality_grade text;
  issues text[] := ARRAY[]::text[];
  recommendations text[] := ARRAY[]::text[];

  min_overall integer;
  min_size integer;
  min_service integer;
  min_geography integer;
  min_buyer_types integer;
BEGIN
  -- Extract confidence scores from JSONB
  overall_confidence := COALESCE((criteria->>'overall_confidence')::numeric, 0);
  size_confidence := COALESCE((criteria->'size_criteria'->>'confidence_score')::numeric, 0);
  service_confidence := COALESCE((criteria->'service_criteria'->>'confidence_score')::numeric, 0);
  geography_confidence := COALESCE((criteria->'geography_criteria'->>'confidence_score')::numeric, 0);
  buyer_types_confidence := COALESCE((criteria->'buyer_types_criteria'->>'confidence_score')::numeric, 0);

  -- Get thresholds
  SELECT minimum_score INTO min_overall FROM criteria_quality_thresholds WHERE criteria_type = 'overall';
  SELECT minimum_score INTO min_size FROM criteria_quality_thresholds WHERE criteria_type = 'size';
  SELECT minimum_score INTO min_service FROM criteria_quality_thresholds WHERE criteria_type = 'service';
  SELECT minimum_score INTO min_geography FROM criteria_quality_thresholds WHERE criteria_type = 'geography';
  SELECT minimum_score INTO min_buyer_types FROM criteria_quality_thresholds WHERE criteria_type = 'buyer_types';

  -- Determine quality grade
  IF overall_confidence >= 90 THEN
    quality_grade := 'excellent';
  ELSIF overall_confidence >= 60 THEN
    quality_grade := 'good';
  ELSIF overall_confidence >= 30 THEN
    quality_grade := 'acceptable';
  ELSE
    quality_grade := 'poor';
  END IF;

  -- Check overall confidence
  IF overall_confidence < min_overall THEN
    is_valid := false;
    issues := array_append(issues, format('Overall confidence %s%% is below minimum threshold of %s%%', overall_confidence, min_overall));
    recommendations := array_append(recommendations, 'Regenerate M&A guide with more specific buyer criteria, deal size information, and buyer profiles');
  END IF;

  -- Check size criteria
  IF size_confidence < min_size THEN
    issues := array_append(issues, format('Size criteria confidence %s%% is below threshold of %s%%', size_confidence, min_size));
    recommendations := array_append(recommendations, 'Add explicit revenue/EBITDA ranges or company size indicators (small, mid-market, enterprise)');
  END IF;

  -- Check service criteria
  IF service_confidence < min_service THEN
    issues := array_append(issues, format('Service criteria confidence %s%% is below threshold of %s%%', service_confidence, min_service));
    recommendations := array_append(recommendations, 'Specify target services, business models, and service mix preferences buyers look for');
  END IF;

  -- Check geography criteria
  IF geography_confidence < min_geography THEN
    issues := array_append(issues, format('Geography criteria confidence %s%% is below threshold of %s%%', geography_confidence, min_geography));
    recommendations := array_append(recommendations, 'Add geographic preferences: specific states, regions (Northeast, Southeast), or coverage type (local, regional, national)');
  END IF;

  -- Check buyer types
  IF buyer_types_confidence < min_buyer_types THEN
    issues := array_append(issues, format('Buyer types confidence %s%% is below threshold of %s%%', buyer_types_confidence, min_buyer_types));
    recommendations := array_append(recommendations, 'Describe buyer types: PE firms, platform companies, strategic buyers, family offices with their typical criteria');
  END IF;

  -- Check for empty arrays (even with decent confidence, empty data is problematic)
  IF jsonb_array_length(COALESCE(criteria->'service_criteria'->'target_services', '[]'::jsonb)) = 0 THEN
    issues := array_append(issues, 'No target services extracted');
  END IF;

  IF jsonb_array_length(COALESCE(criteria->'geography_criteria'->'target_states', '[]'::jsonb)) = 0
     AND jsonb_array_length(COALESCE(criteria->'geography_criteria'->'target_regions', '[]'::jsonb)) = 0 THEN
    issues := array_append(issues, 'No geographic preferences extracted');
  END IF;

  IF jsonb_array_length(COALESCE(criteria->'buyer_types_criteria'->'buyer_types', '[]'::jsonb)) = 0 THEN
    issues := array_append(issues, 'No buyer type profiles extracted');
    is_valid := false; -- This is critical
  END IF;

  -- Return validation result
  RETURN jsonb_build_object(
    'is_valid', is_valid,
    'quality_grade', quality_grade,
    'overall_confidence', overall_confidence,
    'confidence_breakdown', jsonb_build_object(
      'size', size_confidence,
      'service', service_confidence,
      'geography', geography_confidence,
      'buyer_types', buyer_types_confidence
    ),
    'issues', to_jsonb(issues),
    'recommendations', to_jsonb(recommendations)
  );
END;
$$;

COMMENT ON FUNCTION validate_buyer_criteria_quality IS
  'Validate buyer criteria extraction quality. Returns is_valid, quality_grade, issues, and recommendations.';

-- ============= VALIDATION TRIGGER =============

/**
 * Trigger function to validate criteria before insert/update
 * Rejects invalid criteria extractions
 */
CREATE OR REPLACE FUNCTION validate_criteria_extraction_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  validation_result jsonb;
  is_valid boolean;
BEGIN
  -- Only validate when extraction is marked as completed
  IF NEW.status = 'completed' AND NEW.extracted_criteria IS NOT NULL THEN
    -- Validate the criteria
    validation_result := validate_buyer_criteria_quality(NEW.extracted_criteria);
    is_valid := (validation_result->>'is_valid')::boolean;

    -- If not valid, change status to 'needs_review'
    IF NOT is_valid THEN
      NEW.status := 'needs_review';
      NEW.error := 'Extraction quality below acceptable thresholds';

      -- Store validation result in metadata for reference
      NEW.extracted_criteria := jsonb_set(
        NEW.extracted_criteria,
        '{_validation}',
        validation_result
      );

      -- Log to console
      RAISE WARNING 'Criteria extraction % marked as needs_review: %',
        NEW.id,
        validation_result->>'issues';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply trigger to buyer_criteria_extractions table
DROP TRIGGER IF EXISTS validate_criteria_quality_trigger ON buyer_criteria_extractions;
CREATE TRIGGER validate_criteria_quality_trigger
  BEFORE INSERT OR UPDATE ON buyer_criteria_extractions
  FOR EACH ROW
  EXECUTE FUNCTION validate_criteria_extraction_trigger();

COMMENT ON FUNCTION validate_criteria_extraction_trigger IS
  'Trigger that validates criteria quality. Changes status to needs_review if quality is insufficient.';

-- ============= HELPER VIEWS =============

-- View for extractions needing review
CREATE OR REPLACE VIEW criteria_needing_review AS
SELECT
  e.id,
  e.universe_id,
  u.name as universe_name,
  e.status,
  e.extracted_criteria->'_validation'->>'quality_grade' as quality_grade,
  e.extracted_criteria->'_validation'->'confidence_breakdown' as confidence_scores,
  e.extracted_criteria->'_validation'->'issues' as issues,
  e.extracted_criteria->'_validation'->'recommendations' as recommendations,
  e.created_at,
  e.completed_at
FROM buyer_criteria_extractions e
LEFT JOIN remarketing_universes u ON u.id = e.universe_id
WHERE e.status = 'needs_review'
ORDER BY e.created_at DESC;

COMMENT ON VIEW criteria_needing_review IS
  'Criteria extractions that need manual review due to low quality. Shows validation details and recommendations.';

-- View for quality statistics
CREATE OR REPLACE VIEW criteria_quality_stats AS
SELECT
  DATE(completed_at) as date,
  COUNT(*) as total_extractions,
  COUNT(*) FILTER (WHERE extracted_criteria->'_validation'->>'quality_grade' = 'excellent') as excellent_count,
  COUNT(*) FILTER (WHERE extracted_criteria->'_validation'->>'quality_grade' = 'good') as good_count,
  COUNT(*) FILTER (WHERE extracted_criteria->'_validation'->>'quality_grade' = 'acceptable') as acceptable_count,
  COUNT(*) FILTER (WHERE extracted_criteria->'_validation'->>'quality_grade' = 'poor') as poor_count,
  COUNT(*) FILTER (WHERE status = 'needs_review') as needs_review_count,
  ROUND(AVG((extracted_criteria->>'overall_confidence')::numeric), 1) as avg_confidence
FROM buyer_criteria_extractions
WHERE status IN ('completed', 'needs_review')
  AND completed_at IS NOT NULL
GROUP BY DATE(completed_at)
ORDER BY date DESC;

COMMENT ON VIEW criteria_quality_stats IS
  'Daily statistics on criteria extraction quality. Use for monitoring extraction performance over time.';
