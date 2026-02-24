-- Contact Intelligence: enriched_contacts, contact_search_cache, contact_search_log
-- Supports the find-contacts and discover-companies edge functions

-- 1. Enriched contacts table (stores Prospeo + Apify results)
CREATE TABLE IF NOT EXISTS enriched_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  full_name text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  email text,
  phone text,
  linkedin_url text NOT NULL DEFAULT '',
  confidence text NOT NULL DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
  source text NOT NULL DEFAULT 'unknown',
  enriched_at timestamptz NOT NULL DEFAULT now(),
  search_query text,
  buyer_id uuid REFERENCES remarketing_buyers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Unique constraint for dedup
  UNIQUE(workspace_id, linkedin_url)
);

-- 2. Search cache (avoid re-scraping within 7 days)
CREATE TABLE IF NOT EXISTS contact_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  company_name text NOT NULL,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Search log (audit trail)
CREATE TABLE IF NOT EXISTS contact_search_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  title_filter text[] DEFAULT '{}',
  results_count integer NOT NULL DEFAULT 0,
  from_cache boolean NOT NULL DEFAULT false,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enriched_contacts_workspace ON enriched_contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_enriched_contacts_company ON enriched_contacts(company_name);
CREATE INDEX IF NOT EXISTS idx_enriched_contacts_email ON enriched_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enriched_contacts_buyer ON enriched_contacts(buyer_id) WHERE buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_search_cache_key ON contact_search_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_contact_search_cache_created ON contact_search_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_search_log_user ON contact_search_log(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_search_log_created ON contact_search_log(created_at);

-- RLS policies
ALTER TABLE enriched_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_search_log ENABLE ROW LEVEL SECURITY;

-- Enriched contacts: users can read their own
CREATE POLICY enriched_contacts_select ON enriched_contacts
  FOR SELECT USING (workspace_id = auth.uid());

-- Enriched contacts: service role can insert/update
CREATE POLICY enriched_contacts_service_insert ON enriched_contacts
  FOR INSERT WITH CHECK (true);

CREATE POLICY enriched_contacts_service_update ON enriched_contacts
  FOR UPDATE USING (true);

-- Cache: service role access
CREATE POLICY contact_search_cache_all ON contact_search_cache
  FOR ALL USING (true);

-- Log: users can read their own
CREATE POLICY contact_search_log_select ON contact_search_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY contact_search_log_service_insert ON contact_search_log
  FOR INSERT WITH CHECK (true);

-- Updated_at trigger for enriched_contacts
CREATE OR REPLACE FUNCTION update_enriched_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enriched_contacts_updated_at
  BEFORE UPDATE ON enriched_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_enriched_contacts_updated_at();
