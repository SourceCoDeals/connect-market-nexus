-- Invalidate buyer recommendation cache when scoring-relevant buyer fields change.
-- Without this, stale cached results persist for up to 4 hours after buyer edits.
-- We expire ALL cache entries because every deal is scored against every buyer.

CREATE OR REPLACE FUNCTION invalidate_buyer_recommendation_cache()
RETURNS trigger AS $$
BEGIN
  -- Only invalidate when scoring-relevant fields actually changed
  IF (
    OLD.target_services    IS DISTINCT FROM NEW.target_services OR
    OLD.target_industries  IS DISTINCT FROM NEW.target_industries OR
    OLD.industry_vertical  IS DISTINCT FROM NEW.industry_vertical OR
    OLD.target_geographies IS DISTINCT FROM NEW.target_geographies OR
    OLD.geographic_footprint IS DISTINCT FROM NEW.geographic_footprint OR
    OLD.target_ebitda_min  IS DISTINCT FROM NEW.target_ebitda_min OR
    OLD.target_ebitda_max  IS DISTINCT FROM NEW.target_ebitda_max OR
    OLD.has_fee_agreement  IS DISTINCT FROM NEW.has_fee_agreement OR
    OLD.acquisition_appetite IS DISTINCT FROM NEW.acquisition_appetite OR
    OLD.total_acquisitions IS DISTINCT FROM NEW.total_acquisitions OR
    OLD.thesis_summary     IS DISTINCT FROM NEW.thesis_summary OR
    OLD.hq_state           IS DISTINCT FROM NEW.hq_state OR
    OLD.archived           IS DISTINCT FROM NEW.archived
  ) THEN
    -- Expire all cached recommendations immediately by setting expires_at to now
    UPDATE buyer_recommendation_cache SET expires_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also invalidate when a buyer is deleted (removes them from future scoring)
CREATE OR REPLACE FUNCTION invalidate_buyer_recommendation_cache_on_delete()
RETURNS trigger AS $$
BEGIN
  UPDATE buyer_recommendation_cache SET expires_at = NOW();
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS invalidate_rec_cache_on_buyer_update ON remarketing_buyers;
CREATE TRIGGER invalidate_rec_cache_on_buyer_update
  AFTER UPDATE ON remarketing_buyers
  FOR EACH ROW
  EXECUTE FUNCTION invalidate_buyer_recommendation_cache();

DROP TRIGGER IF EXISTS invalidate_rec_cache_on_buyer_delete ON remarketing_buyers;
CREATE TRIGGER invalidate_rec_cache_on_buyer_delete
  AFTER DELETE ON remarketing_buyers
  FOR EACH ROW
  EXECUTE FUNCTION invalidate_buyer_recommendation_cache_on_delete();
