-- ============================================================================
-- FIRM MEMBERS EXTENSION - Track Both Marketplace Users AND Leads
-- ============================================================================

-- Add member_type to distinguish between marketplace users and leads
ALTER TABLE firm_members 
ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'marketplace_user'
CHECK (member_type IN ('marketplace_user', 'lead'));

-- Add lead-specific fields
ALTER TABLE firm_members
ADD COLUMN IF NOT EXISTS lead_email TEXT,
ADD COLUMN IF NOT EXISTS lead_name TEXT,
ADD COLUMN IF NOT EXISTS lead_company TEXT,
ADD COLUMN IF NOT EXISTS connection_request_id UUID REFERENCES connection_requests(id),
ADD COLUMN IF NOT EXISTS inbound_lead_id UUID REFERENCES inbound_leads(id);

-- Allow user_id to be nullable for lead-based members
ALTER TABLE firm_members ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint: user_id required for marketplace_user type, lead_email required for lead type
ALTER TABLE firm_members DROP CONSTRAINT IF EXISTS firm_members_user_id_key;
ALTER TABLE firm_members ADD CONSTRAINT firm_members_type_data_check 
CHECK (
  (member_type = 'marketplace_user' AND user_id IS NOT NULL) OR
  (member_type = 'lead' AND lead_email IS NOT NULL)
);

-- Create unique constraint for leads (one lead email per firm)
CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_members_lead_email_unique 
ON firm_members(firm_id, lead_email) 
WHERE member_type = 'lead';

-- Keep unique constraint for marketplace users
CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_members_user_id_unique 
ON firm_members(firm_id, user_id) 
WHERE member_type = 'marketplace_user' AND user_id IS NOT NULL;

-- Add indexes for lookups
CREATE INDEX IF NOT EXISTS idx_firm_members_connection_request ON firm_members(connection_request_id);
CREATE INDEX IF NOT EXISTS idx_firm_members_inbound_lead ON firm_members(inbound_lead_id);
CREATE INDEX IF NOT EXISTS idx_firm_members_lead_email ON firm_members(lead_email);

-- ============================================================================
-- Update auto_link_user_to_firm to detect and upgrade lead-based members
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_link_user_to_firm()
RETURNS TRIGGER AS $$
DECLARE
  v_firm_id UUID;
  v_email_domain TEXT;
  v_website_domain TEXT;
  v_normalized_company TEXT;
  v_existing_lead_member_id UUID;
  v_generic_domains TEXT[] := ARRAY['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com', 'protonmail.com'];
BEGIN
  -- Extract domains
  IF NEW.email IS NOT NULL THEN
    v_email_domain := extract_domain(NEW.email);
  END IF;
  
  IF NEW.website IS NOT NULL THEN
    v_website_domain := extract_domain(NEW.website);
  END IF;
  
  -- Normalize company name
  IF NEW.company_name IS NOT NULL THEN
    v_normalized_company := normalize_company_name(NEW.company_name);
  END IF;
  
  -- Try to find existing firm (avoid generic email domains)
  IF v_normalized_company IS NOT NULL OR (v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains)) OR v_website_domain IS NOT NULL THEN
    SELECT id INTO v_firm_id
    FROM firm_agreements
    WHERE 
      (normalized_company_name = v_normalized_company AND v_normalized_company IS NOT NULL)
      OR (email_domain = v_email_domain AND v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains))
      OR (website_domain = v_website_domain AND v_website_domain IS NOT NULL)
    LIMIT 1;
    
    -- If no firm found, create one
    IF v_firm_id IS NULL AND (NEW.company_name IS NOT NULL OR v_email_domain IS NOT NULL) THEN
      INSERT INTO firm_agreements (
        primary_company_name,
        normalized_company_name,
        email_domain,
        website_domain,
        member_count,
        created_at,
        updated_at
      ) VALUES (
        COALESCE(NEW.company_name, v_email_domain),
        COALESCE(v_normalized_company, v_email_domain),
        CASE WHEN v_email_domain <> ALL(v_generic_domains) THEN v_email_domain ELSE NULL END,
        v_website_domain,
        0,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_firm_id;
    END IF;
    
    -- If firm was found/created, check if this user was previously a lead member
    IF v_firm_id IS NOT NULL THEN
      SELECT id INTO v_existing_lead_member_id
      FROM firm_members
      WHERE firm_id = v_firm_id
        AND member_type = 'lead'
        AND LOWER(lead_email) = LOWER(NEW.email);
      
      IF v_existing_lead_member_id IS NOT NULL THEN
        -- Upgrade existing lead member to marketplace user
        UPDATE firm_members
        SET 
          member_type = 'marketplace_user',
          user_id = NEW.id,
          updated_at = NOW()
        WHERE id = v_existing_lead_member_id;
      ELSE
        -- Add new marketplace user member
        INSERT INTO firm_members (firm_id, user_id, member_type, added_at)
        VALUES (v_firm_id, NEW.id, 'marketplace_user', NOW())
        ON CONFLICT DO NOTHING;
      END IF;
      
      -- Update member count
      UPDATE firm_agreements
      SET 
        member_count = (SELECT COUNT(*) FROM firm_members WHERE firm_id = v_firm_id),
        updated_at = NOW()
      WHERE id = v_firm_id;
      
      -- Sync agreement status from firm to user
      UPDATE profiles
      SET 
        fee_agreement_signed = CASE 
          WHEN (SELECT fee_agreement_signed FROM firm_agreements WHERE id = v_firm_id) THEN TRUE
          ELSE fee_agreement_signed
        END,
        fee_agreement_signed_at = CASE 
          WHEN (SELECT fee_agreement_signed FROM firm_agreements WHERE id = v_firm_id) AND NOT COALESCE(fee_agreement_signed, FALSE)
          THEN (SELECT fee_agreement_signed_at FROM firm_agreements WHERE id = v_firm_id)
          ELSE fee_agreement_signed_at
        END,
        nda_signed = CASE 
          WHEN (SELECT nda_signed FROM firm_agreements WHERE id = v_firm_id) THEN TRUE
          ELSE nda_signed
        END,
        nda_signed_at = CASE 
          WHEN (SELECT nda_signed FROM firm_agreements WHERE id = v_firm_id) AND NOT COALESCE(nda_signed, FALSE)
          THEN (SELECT nda_signed_at FROM firm_agreements WHERE id = v_firm_id)
          ELSE nda_signed_at
        END,
        updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ============================================================================
-- Update sync_connection_request_firm to create lead-based firm members
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_connection_request_firm()
RETURNS TRIGGER AS $$
DECLARE
  v_firm_id UUID;
  v_firm_record RECORD;
  v_email_domain TEXT;
  v_normalized_company TEXT;
  v_generic_domains TEXT[] := ARRAY['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com', 'protonmail.com'];
  v_lead_email TEXT;
  v_lead_name TEXT;
  v_lead_company TEXT;
BEGIN
  -- Case 1: Connection request from marketplace user (has user_id)
  IF NEW.user_id IS NOT NULL THEN
    SELECT firm_id INTO v_firm_id
    FROM firm_members
    WHERE user_id = NEW.user_id
    LIMIT 1;
    
    NEW.firm_id := v_firm_id;
  
  -- Case 2: Connection request from lead (has source_lead_id)
  ELSIF NEW.source_lead_id IS NOT NULL THEN
    SELECT firm_id, email, name, company_name INTO v_firm_id, v_lead_email, v_lead_name, v_lead_company
    FROM inbound_leads
    WHERE id = NEW.source_lead_id;
    
    NEW.firm_id := v_firm_id;
  
  -- Case 3: Manual connection request with lead_company and/or lead_email
  ELSIF NEW.lead_company IS NOT NULL OR NEW.lead_email IS NOT NULL THEN
    v_lead_email := NEW.lead_email;
    v_lead_name := NEW.lead_name;
    v_lead_company := NEW.lead_company;
    
    IF NEW.lead_email IS NOT NULL THEN
      v_email_domain := extract_domain(NEW.lead_email);
    END IF;
    
    IF NEW.lead_company IS NOT NULL THEN
      v_normalized_company := normalize_company_name(NEW.lead_company);
    END IF;
    
    -- Try to find existing firm (avoid generic domains)
    IF v_normalized_company IS NOT NULL OR (v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains)) THEN
      SELECT id INTO v_firm_id
      FROM firm_agreements
      WHERE 
        (normalized_company_name = v_normalized_company AND v_normalized_company IS NOT NULL)
        OR (email_domain = v_email_domain AND v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains))
      LIMIT 1;
      
      -- Create firm if not found
      IF v_firm_id IS NULL THEN
        INSERT INTO firm_agreements (
          primary_company_name,
          normalized_company_name,
          email_domain,
          member_count,
          created_at,
          updated_at
        ) VALUES (
          COALESCE(NEW.lead_company, v_email_domain),
          COALESCE(v_normalized_company, v_email_domain),
          CASE WHEN v_email_domain <> ALL(v_generic_domains) THEN v_email_domain ELSE NULL END,
          0,
          NOW(),
          NOW()
        )
        RETURNING id INTO v_firm_id;
      END IF;
      
      NEW.firm_id := v_firm_id;
    END IF;
  END IF;
  
  -- If firm exists and this is a lead-based request, add to firm_members
  IF v_firm_id IS NOT NULL AND NEW.user_id IS NULL AND v_lead_email IS NOT NULL THEN
    INSERT INTO firm_members (
      firm_id,
      member_type,
      lead_email,
      lead_name,
      lead_company,
      connection_request_id,
      inbound_lead_id,
      added_at
    ) VALUES (
      v_firm_id,
      'lead',
      v_lead_email,
      v_lead_name,
      v_lead_company,
      NEW.id,
      NEW.source_lead_id,
      NOW()
    )
    ON CONFLICT (firm_id, lead_email) WHERE member_type = 'lead'
    DO UPDATE SET
      connection_request_id = COALESCE(EXCLUDED.connection_request_id, firm_members.connection_request_id),
      inbound_lead_id = COALESCE(EXCLUDED.inbound_lead_id, firm_members.inbound_lead_id),
      lead_name = COALESCE(EXCLUDED.lead_name, firm_members.lead_name),
      lead_company = COALESCE(EXCLUDED.lead_company, firm_members.lead_company),
      updated_at = NOW();
    
    -- Update member count
    UPDATE firm_agreements
    SET 
      member_count = (SELECT COUNT(*) FROM firm_members WHERE firm_id = v_firm_id),
      updated_at = NOW()
    WHERE id = v_firm_id;
  END IF;
  
  -- Inherit agreement status (use most permissive rule)
  IF v_firm_id IS NOT NULL THEN
    SELECT * INTO v_firm_record
    FROM firm_agreements
    WHERE id = v_firm_id;
    
    -- Fee Agreement
    IF v_firm_record.fee_agreement_signed AND NOT COALESCE(NEW.lead_fee_agreement_signed, FALSE) THEN
      NEW.lead_fee_agreement_signed := TRUE;
      NEW.lead_fee_agreement_signed_at := v_firm_record.fee_agreement_signed_at;
      NEW.lead_fee_agreement_signed_by := v_firm_record.fee_agreement_signed_by;
    ELSIF COALESCE(NEW.lead_fee_agreement_signed, FALSE) AND NOT v_firm_record.fee_agreement_signed THEN
      UPDATE firm_agreements
      SET 
        fee_agreement_signed = TRUE,
        fee_agreement_signed_at = COALESCE(NEW.lead_fee_agreement_signed_at, NOW()),
        fee_agreement_signed_by = COALESCE(NEW.lead_fee_agreement_signed_by, auth.uid()),
        updated_at = NOW()
      WHERE id = v_firm_id;
    END IF;
    
    -- NDA
    IF v_firm_record.nda_signed AND NOT COALESCE(NEW.lead_nda_signed, FALSE) THEN
      NEW.lead_nda_signed := TRUE;
      NEW.lead_nda_signed_at := v_firm_record.nda_signed_at;
      NEW.lead_nda_signed_by := v_firm_record.nda_signed_by;
    ELSIF COALESCE(NEW.lead_nda_signed, FALSE) AND NOT v_firm_record.nda_signed THEN
      UPDATE firm_agreements
      SET 
        nda_signed = TRUE,
        nda_signed_at = COALESCE(NEW.lead_nda_signed_at, NOW()),
        nda_signed_by = COALESCE(NEW.lead_nda_signed_by, auth.uid()),
        updated_at = NOW()
      WHERE id = v_firm_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Recreate trigger
DROP TRIGGER IF EXISTS sync_connection_request_firm_trigger ON connection_requests;
CREATE TRIGGER sync_connection_request_firm_trigger
  BEFORE INSERT OR UPDATE ON connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_connection_request_firm();

-- ============================================================================
-- Backfill existing lead-based members
-- ============================================================================

-- Add lead-based members from connection_requests
INSERT INTO firm_members (
  firm_id,
  member_type,
  lead_email,
  lead_name,
  lead_company,
  connection_request_id,
  added_at
)
SELECT DISTINCT ON (cr.firm_id, cr.lead_email)
  cr.firm_id,
  'lead',
  cr.lead_email,
  cr.lead_name,
  cr.lead_company,
  cr.id,
  cr.created_at
FROM connection_requests cr
WHERE cr.firm_id IS NOT NULL
  AND cr.user_id IS NULL
  AND cr.lead_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM firm_members fm 
    WHERE fm.firm_id = cr.firm_id 
      AND LOWER(fm.lead_email) = LOWER(cr.lead_email)
      AND fm.member_type = 'lead'
  )
ORDER BY cr.firm_id, cr.lead_email, cr.created_at ASC
ON CONFLICT (firm_id, lead_email) WHERE member_type = 'lead' DO NOTHING;

-- Add lead-based members from inbound_leads
INSERT INTO firm_members (
  firm_id,
  member_type,
  lead_email,
  lead_name,
  lead_company,
  inbound_lead_id,
  added_at
)
SELECT DISTINCT ON (il.firm_id, il.email)
  il.firm_id,
  'lead',
  il.email,
  il.name,
  il.company_name,
  il.id,
  il.created_at
FROM inbound_leads il
WHERE il.firm_id IS NOT NULL
  AND il.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM firm_members fm 
    WHERE fm.firm_id = il.firm_id 
      AND LOWER(fm.lead_email) = LOWER(il.email)
  )
ORDER BY il.firm_id, il.email, il.created_at ASC
ON CONFLICT (firm_id, lead_email) WHERE member_type = 'lead' DO NOTHING;

-- Update all firm member counts
UPDATE firm_agreements
SET member_count = (
  SELECT COUNT(*) 
  FROM firm_members 
  WHERE firm_id = firm_agreements.id
);