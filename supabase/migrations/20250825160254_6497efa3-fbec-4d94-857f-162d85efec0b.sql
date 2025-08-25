-- Create automated data restoration function
CREATE OR REPLACE FUNCTION public.restore_profile_data_automated()
RETURNS TABLE(
  profile_id uuid,
  restoration_type text,
  old_value jsonb,
  new_value jsonb,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_record RECORD;
  snapshot_record RECORD;
  current_categories jsonb;
  current_locations jsonb;
  raw_categories jsonb;
  raw_locations jsonb;
  should_restore_categories boolean;
  should_restore_locations boolean;
  restored_count integer := 0;
BEGIN
  -- Loop through all profiles that have snapshots
  FOR profile_record IN 
    SELECT DISTINCT p.id, p.email, p.business_categories, p.target_locations, p.industry_expertise
    FROM profiles p
    INNER JOIN profile_data_snapshots pds ON p.id = pds.profile_id
    WHERE pds.snapshot_type = 'raw_signup'
  LOOP
    -- Get the most recent raw snapshot for this profile
    SELECT raw_business_categories, raw_target_locations
    INTO raw_categories, raw_locations
    FROM profile_data_snapshots
    WHERE profile_id = profile_record.id 
      AND snapshot_type = 'raw_signup'
    ORDER BY created_at DESC
    LIMIT 1;
    
    current_categories := profile_record.business_categories;
    current_locations := profile_record.target_locations;
    
    should_restore_categories := false;
    should_restore_locations := false;
    
    -- Check if categories need restoration (over-standardization detection)
    IF raw_categories IS NOT NULL AND current_categories IS NOT NULL THEN
      -- Case 1: Current has 1-2 generic categories but raw had 3+ specific ones
      IF jsonb_array_length(current_categories) <= 2 AND jsonb_array_length(raw_categories) >= 3 THEN
        should_restore_categories := true;
      END IF;
      
      -- Case 2: Current is generic "Technology & Software" but raw was different
      IF current_categories ? 'Technology & Software' AND 
         jsonb_array_length(current_categories) = 1 AND
         NOT (raw_categories ? 'Technology & Software' OR raw_categories ? 'technology' OR raw_categories ? 'software') THEN
        should_restore_categories := true;
      END IF;
      
      -- Case 3: Current is "Professional Services" but raw was specific
      IF current_categories ? 'Professional Services' AND 
         jsonb_array_length(current_categories) = 1 AND
         NOT (raw_categories ? 'Professional Services' OR raw_categories ? 'professional') THEN
        should_restore_categories := true;
      END IF;
      
      -- Case 4: Raw had "All Industries" or "any" but current doesn't
      IF (raw_categories ? 'All Industries' OR raw_categories ? 'any' OR raw_categories ? 'all') AND
         NOT (current_categories ? 'All Industries') THEN
        should_restore_categories := true;
      END IF;
    END IF;
    
    -- Check if locations need restoration
    IF raw_locations IS NOT NULL AND current_locations IS NOT NULL THEN
      -- Case 1: Raw had specific descriptions but current is generic
      IF jsonb_array_length(raw_locations) > 0 AND jsonb_array_length(current_locations) > 0 THEN
        -- Look for cases where raw had "Anywhere", "lower 48", etc. but current is standardized
        IF (raw_locations ? 'Anywhere' OR raw_locations ? 'anywhere' OR 
            raw_locations ? 'lower 48' OR raw_locations ? 'nationwide') AND
           NOT (current_locations ? 'United States') THEN
          should_restore_locations := true;
        END IF;
      END IF;
    END IF;
    
    -- Restore categories if needed
    IF should_restore_categories THEN
      UPDATE profiles
      SET business_categories = raw_categories,
          updated_at = NOW()
      WHERE id = profile_record.id;
      
      profile_id := profile_record.id;
      restoration_type := 'business_categories';
      old_value := current_categories;
      new_value := raw_categories;
      details := 'Restored over-standardized categories from raw signup data';
      restored_count := restored_count + 1;
      RETURN NEXT;
    END IF;
    
    -- Restore locations if needed
    IF should_restore_locations THEN
      UPDATE profiles
      SET target_locations = raw_locations,
          updated_at = NOW()
      WHERE id = profile_record.id;
      
      profile_id := profile_record.id;
      restoration_type := 'target_locations';
      old_value := current_locations;
      new_value := raw_locations;
      details := 'Restored over-standardized locations from raw signup data';
      restored_count := restored_count + 1;
      RETURN NEXT;
    END IF;
    
    -- Fix corrupted industry_expertise (like Adam's case)
    IF profile_record.industry_expertise IS NOT NULL AND 
       profile_record.industry_expertise = 'ffffffffffff' THEN
      UPDATE profiles
      SET industry_expertise = NULL,
          updated_at = NOW()
      WHERE id = profile_record.id;
      
      profile_id := profile_record.id;
      restoration_type := 'industry_expertise';
      old_value := to_jsonb(profile_record.industry_expertise);
      new_value := to_jsonb(NULL);
      details := 'Cleared corrupted industry_expertise data';
      restored_count := restored_count + 1;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  -- Log the restoration summary
  INSERT INTO audit_logs (
    table_name,
    operation,
    metadata,
    admin_id
  ) VALUES (
    'profiles',
    'automated_data_restoration',
    jsonb_build_object(
      'total_restorations', restored_count,
      'timestamp', NOW()
    ),
    auth.uid()
  );
  
  RETURN;
END;
$$;

-- Create function to preview what would be restored (without making changes)
CREATE OR REPLACE FUNCTION public.preview_profile_data_restoration()
RETURNS TABLE(
  profile_id uuid,
  email text,
  current_categories jsonb,
  raw_categories jsonb,
  current_locations jsonb,
  raw_locations jsonb,
  restoration_needed text,
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN 
    SELECT p.id, p.email, p.business_categories, p.target_locations, p.industry_expertise,
           pds.raw_business_categories, pds.raw_target_locations
    FROM profiles p
    INNER JOIN profile_data_snapshots pds ON p.id = pds.profile_id
    WHERE pds.snapshot_type = 'raw_signup'
  LOOP
    profile_id := profile_record.id;
    email := profile_record.email;
    current_categories := profile_record.business_categories;
    raw_categories := profile_record.raw_business_categories;
    current_locations := profile_record.target_locations;
    raw_locations := profile_record.raw_target_locations;
    restoration_needed := '';
    issue_type := '';
    
    -- Check for category issues
    IF raw_categories IS NOT NULL AND current_categories IS NOT NULL THEN
      IF jsonb_array_length(current_categories) <= 2 AND jsonb_array_length(raw_categories) >= 3 THEN
        restoration_needed := restoration_needed || 'Categories: Over-standardized; ';
        issue_type := 'over_standardized';
      ELSIF current_categories ? 'Technology & Software' AND jsonb_array_length(current_categories) = 1 AND
            NOT (raw_categories ? 'Technology & Software' OR raw_categories ? 'technology' OR raw_categories ? 'software') THEN
        restoration_needed := restoration_needed || 'Categories: Wrong standardization; ';
        issue_type := 'wrong_standardization';
      ELSIF (raw_categories ? 'All Industries' OR raw_categories ? 'any') AND NOT (current_categories ? 'All Industries') THEN
        restoration_needed := restoration_needed || 'Categories: Lost "All Industries"; ';
        issue_type := 'lost_all_industries';
      END IF;
    END IF;
    
    -- Check for location issues
    IF raw_locations IS NOT NULL AND current_locations IS NOT NULL THEN
      IF (raw_locations ? 'Anywhere' OR raw_locations ? 'anywhere' OR 
          raw_locations ? 'lower 48' OR raw_locations ? 'nationwide') AND
         NOT (current_locations ? 'United States') THEN
        restoration_needed := restoration_needed || 'Locations: Lost specific descriptions; ';
        issue_type := COALESCE(issue_type || ',', '') || 'lost_location_descriptions';
      END IF;
    END IF;
    
    -- Check for corrupted fields
    IF profile_record.industry_expertise = 'ffffffffffff' THEN
      restoration_needed := restoration_needed || 'Industry Expertise: Corrupted data; ';
      issue_type := COALESCE(issue_type || ',', '') || 'corrupted_field';
    END IF;
    
    -- Only return rows that need restoration
    IF restoration_needed != '' THEN
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;