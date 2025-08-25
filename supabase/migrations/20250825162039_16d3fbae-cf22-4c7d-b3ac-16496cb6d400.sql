-- Fix the polymorphic type issue in restore_profile_data_automated function
CREATE OR REPLACE FUNCTION public.restore_profile_data_automated()
RETURNS TABLE(profile_id uuid, restoration_type text, old_value jsonb, new_value jsonb, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  p record;
  curr_categories jsonb;
  curr_locations jsonb;
  curr_industry jsonb;

  snap_raw_categories jsonb;
  snap_raw_locations jsonb;
  snap_raw_payload jsonb;
  snap_raw_industry jsonb;

  should_restore_categories boolean;
  should_restore_locations boolean;

  generic_current boolean;
  raw_industry_valid boolean;
  restored_count integer := 0;
begin
  for p in
    select id, email, business_categories, target_locations, industry_expertise
    from public.profiles
  loop
    -- Load best snapshot
    select s.raw_business_categories, s.raw_target_locations, s.raw_payload
    into snap_raw_categories, snap_raw_locations, snap_raw_payload
    from public.get_latest_profile_snapshot(p.id) s;

    if snap_raw_categories is null and snap_raw_locations is null and snap_raw_payload is null then
      continue;
    end if;

    curr_categories := p.business_categories;
    curr_locations := p.target_locations;
    curr_industry := p.industry_expertise;
    snap_raw_industry := nullif(coalesce(snap_raw_payload->'industry_expertise', snap_raw_payload->'industryExpertise'), 'null'::jsonb);

    should_restore_categories := false;
    should_restore_locations := false;

    -- Categories restore
    if snap_raw_categories is not null and curr_categories is not null then
      if jsonb_array_length(curr_categories) <= 2 and jsonb_array_length(snap_raw_categories) >= 3 then
        should_restore_categories := true;
      end if;

      if (curr_categories ? 'Technology & Software') and
         jsonb_array_length(curr_categories) = 1 and
         not (snap_raw_categories ? 'Technology & Software' or snap_raw_categories ? 'technology' or snap_raw_categories ? 'software') then
        should_restore_categories := true;
      end if;

      if (snap_raw_categories ? 'All Industries' or snap_raw_categories ? 'any' or snap_raw_categories ? 'all')
         and not (curr_categories ? 'All Industries') then
        should_restore_categories := true;
      end if;
    end if;

    -- Locations restore
    if snap_raw_locations is not null and curr_locations is not null then
      if (snap_raw_locations ? 'Anywhere' or snap_raw_locations ? 'anywhere' or snap_raw_locations ? 'lower 48' or snap_raw_locations ? 'nationwide')
         and not (curr_locations ? 'United States') then
        should_restore_locations := true;
      end if;
    end if;

    -- Apply categories
    if should_restore_categories then
      update public.profiles
      set business_categories = snap_raw_categories,
          updated_at = now()
      where id = p.id;

      profile_id := p.id;
      restoration_type := 'business_categories';
      old_value := curr_categories;
      new_value := snap_raw_categories;
      details := 'Restored over-standardized categories from latest snapshot';
      restored_count := restored_count + 1;
      return next;
    end if;

    -- Apply locations
    if should_restore_locations then
      update public.profiles
      set target_locations = snap_raw_locations,
          updated_at = now()
      where id = p.id;

      profile_id := p.id;
      restoration_type := 'target_locations';
      old_value := curr_locations;
      new_value := snap_raw_locations;
      details := 'Restored over-standardized locations from latest snapshot';
      restored_count := restored_count + 1;
      return next;
    end if;

    -- Industry expertise restoration/cleanup
    -- Determine validity of snapshot raw industry
    raw_industry_valid := false;
    if snap_raw_industry is not null then
      if jsonb_typeof(snap_raw_industry) = 'array' then
        select exists (
          select 1
          from jsonb_array_elements_text(snap_raw_industry) as e(val)
          where length(trim(e.val)) > 2
            and lower(e.val) not in ('n/a','na','test','ffffffffffff')
            and e.val !~* '^[f]+$'
        ) into raw_industry_valid;
      else
        raw_industry_valid := (
          length(trim(snap_raw_industry->>0)) > 2
          and lower(snap_raw_industry->>0) not in ('n/a','na','test','ffffffffffff')
          and (snap_raw_industry->>0 !~ '^[f]+$')
        );
      end if;
    end if;

    generic_current := (curr_industry is not null
                        and jsonb_typeof(curr_industry) = 'array'
                        and jsonb_array_length(curr_industry) = 2
                        and curr_industry @> '["Technology","Manufacturing"]'::jsonb);

    -- Case A: Current is generic overwrite
    if generic_current then
      if raw_industry_valid then
        update public.profiles
        set industry_expertise = snap_raw_industry,
            updated_at = now()
        where id = p.id;

        profile_id := p.id;
        restoration_type := 'industry_expertise';
        old_value := curr_industry;
        new_value := snap_raw_industry;
        details := 'Replaced generic overwrite with valid raw industry_expertise from snapshot';
        restored_count := restored_count + 1;
        return next;
      else
        update public.profiles
        set industry_expertise = null,
            updated_at = now()
        where id = p.id;

        profile_id := p.id;
        restoration_type := 'industry_expertise';
        old_value := curr_industry;
        new_value := 'null'::jsonb;
        details := 'Cleared generic overwrite; snapshot value invalid/garbage';
        restored_count := restored_count + 1;
        return next;
      end if;
    end if;

    -- Case B: Current itself is corrupted (garbage Fs, NA/test)
    if curr_industry is not null and (
      (jsonb_typeof(curr_industry) = 'string' and lower(curr_industry->>0) in ('ffffffffffff','n/a','na','test'))
      or (jsonb_typeof(curr_industry) = 'string' and (curr_industry->>0 ~ '^[fF]+$'))
      or (jsonb_typeof(curr_industry) = 'array' and not exists (
          select 1 from jsonb_array_elements_text(curr_industry) e(val)
          where length(trim(e.val)) > 2 and e.val !~* '^[f]+$' and lower(e.val) not in ('n/a','na','test','ffffffffffff')
      ))
    ) then
      update public.profiles
      set industry_expertise = null,
          updated_at = now()
      where id = p.id;

      profile_id := p.id;
      restoration_type := 'industry_expertise';
      old_value := curr_industry;
      new_value := 'null'::jsonb;
      details := 'Cleared corrupted industry_expertise (garbage/test data)';
      restored_count := restored_count + 1;
      return next;
    end if;

  end loop;

  return;
end;
$function$;