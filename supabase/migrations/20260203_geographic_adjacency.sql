-- Geographic Adjacency Intelligence
-- Maps state-to-state proximity for ~100-mile distance calculations
-- Used in buyer-deal geography scoring to give bonuses for adjacent states

CREATE TABLE IF NOT EXISTS geographic_adjacency (
  state_code TEXT PRIMARY KEY,
  adjacent_states TEXT[] NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for fast adjacency lookups
CREATE INDEX IF NOT EXISTS idx_geographic_adjacency_region ON geographic_adjacency(region);

-- Seed US state adjacency data (50 states + DC)
INSERT INTO geographic_adjacency (state_code, adjacent_states, region) VALUES
  -- Northeast
  ('ME', ARRAY['NH'], 'Northeast'),
  ('NH', ARRAY['ME', 'VT', 'MA'], 'Northeast'),
  ('VT', ARRAY['NH', 'MA', 'NY'], 'Northeast'),
  ('MA', ARRAY['NH', 'VT', 'NY', 'CT', 'RI'], 'Northeast'),
  ('RI', ARRAY['MA', 'CT'], 'Northeast'),
  ('CT', ARRAY['MA', 'RI', 'NY'], 'Northeast'),
  ('NY', ARRAY['VT', 'MA', 'CT', 'NJ', 'PA'], 'Northeast'),
  ('NJ', ARRAY['NY', 'PA', 'DE'], 'Northeast'),
  ('PA', ARRAY['NY', 'NJ', 'DE', 'MD', 'WV', 'OH'], 'Northeast'),
  ('DE', ARRAY['NJ', 'PA', 'MD'], 'Northeast'),
  ('MD', ARRAY['PA', 'DE', 'WV', 'VA'], 'Northeast'),
  ('DC', ARRAY['MD', 'VA'], 'Northeast'),

  -- Southeast
  ('VA', ARRAY['MD', 'DC', 'WV', 'KY', 'TN', 'NC'], 'Southeast'),
  ('WV', ARRAY['PA', 'MD', 'VA', 'KY', 'OH'], 'Southeast'),
  ('KY', ARRAY['WV', 'VA', 'TN', 'MO', 'IL', 'IN', 'OH'], 'Southeast'),
  ('NC', ARRAY['VA', 'TN', 'GA', 'SC'], 'Southeast'),
  ('SC', ARRAY['NC', 'GA'], 'Southeast'),
  ('GA', ARRAY['NC', 'SC', 'FL', 'AL', 'TN'], 'Southeast'),
  ('FL', ARRAY['GA', 'AL'], 'Southeast'),
  ('AL', ARRAY['FL', 'GA', 'TN', 'MS'], 'Southeast'),
  ('MS', ARRAY['AL', 'TN', 'AR', 'LA'], 'Southeast'),
  ('LA', ARRAY['MS', 'AR', 'TX'], 'Southeast'),
  ('TN', ARRAY['KY', 'VA', 'NC', 'GA', 'AL', 'MS', 'AR', 'MO'], 'Southeast'),
  ('AR', ARRAY['TN', 'MS', 'LA', 'TX', 'OK', 'MO'], 'Southeast'),

  -- Midwest
  ('OH', ARRAY['PA', 'WV', 'KY', 'IN', 'MI'], 'Midwest'),
  ('IN', ARRAY['OH', 'KY', 'IL', 'MI'], 'Midwest'),
  ('IL', ARRAY['IN', 'KY', 'MO', 'IA', 'WI'], 'Midwest'),
  ('MI', ARRAY['OH', 'IN', 'WI'], 'Midwest'),
  ('WI', ARRAY['MI', 'IL', 'IA', 'MN'], 'Midwest'),
  ('MN', ARRAY['WI', 'IA', 'SD', 'ND'], 'Midwest'),
  ('IA', ARRAY['IL', 'WI', 'MN', 'SD', 'NE', 'MO'], 'Midwest'),
  ('MO', ARRAY['IA', 'IL', 'KY', 'TN', 'AR', 'OK', 'KS', 'NE'], 'Midwest'),
  ('ND', ARRAY['MN', 'SD', 'MT'], 'Midwest'),
  ('SD', ARRAY['ND', 'MN', 'IA', 'NE', 'WY', 'MT'], 'Midwest'),
  ('NE', ARRAY['SD', 'IA', 'MO', 'KS', 'CO', 'WY'], 'Midwest'),
  ('KS', ARRAY['NE', 'MO', 'OK', 'CO'], 'Midwest'),

  -- Southwest
  ('OK', ARRAY['KS', 'MO', 'AR', 'TX', 'NM', 'CO'], 'Southwest'),
  ('TX', ARRAY['OK', 'AR', 'LA', 'NM'], 'Southwest'),
  ('NM', ARRAY['TX', 'OK', 'CO', 'AZ'], 'Southwest'),
  ('AZ', ARRAY['NM', 'UT', 'NV', 'CA'], 'Southwest'),

  -- West
  ('CO', ARRAY['NE', 'KS', 'OK', 'NM', 'UT', 'WY'], 'West'),
  ('WY', ARRAY['SD', 'NE', 'CO', 'UT', 'ID', 'MT'], 'West'),
  ('MT', ARRAY['ND', 'SD', 'WY', 'ID'], 'West'),
  ('ID', ARRAY['MT', 'WY', 'UT', 'NV', 'OR', 'WA'], 'West'),
  ('UT', ARRAY['ID', 'WY', 'CO', 'NM', 'AZ', 'NV'], 'West'),
  ('NV', ARRAY['ID', 'UT', 'AZ', 'CA', 'OR'], 'West'),

  -- Pacific
  ('WA', ARRAY['ID', 'OR'], 'Pacific'),
  ('OR', ARRAY['WA', 'ID', 'NV', 'CA'], 'Pacific'),
  ('CA', ARRAY['OR', 'NV', 'AZ'], 'Pacific'),
  ('AK', ARRAY[]::TEXT[], 'Pacific'),
  ('HI', ARRAY[]::TEXT[], 'Pacific')
ON CONFLICT (state_code) DO NOTHING;

-- Add comment explaining the table
COMMENT ON TABLE geographic_adjacency IS 'Maps US state adjacency for proximity-based geography scoring. Adjacent states are ~100 miles apart.';
COMMENT ON COLUMN geographic_adjacency.adjacent_states IS 'Array of 2-letter state codes that share a border with this state';
COMMENT ON COLUMN geographic_adjacency.region IS 'US region: Northeast, Southeast, Midwest, Southwest, West, Pacific';
