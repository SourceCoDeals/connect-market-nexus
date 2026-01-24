-- Fix 1: Repair missing remarketing_universe_deals records from existing scores
INSERT INTO remarketing_universe_deals (universe_id, listing_id, status, added_at)
SELECT DISTINCT rs.universe_id, rs.listing_id, 'active', NOW()
FROM remarketing_scores rs
WHERE rs.universe_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM remarketing_universe_deals rud 
  WHERE rud.universe_id = rs.universe_id 
  AND rud.listing_id = rs.listing_id
)
ON CONFLICT DO NOTHING;

-- Add outreach tracking table for tracking buyer introductions through the funnel
CREATE TABLE IF NOT EXISTS remarketing_outreach (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  score_id UUID REFERENCES remarketing_scores(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES remarketing_buyers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'responded', 'meeting_scheduled', 'loi_sent', 'closed_won', 'closed_lost')),
  contact_method TEXT,
  contacted_at TIMESTAMPTZ,
  contacted_by UUID,
  response_at TIMESTAMPTZ,
  meeting_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE remarketing_outreach ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for remarketing_outreach
CREATE POLICY "Allow all operations for authenticated users" ON remarketing_outreach
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_remarketing_outreach_score_id ON remarketing_outreach(score_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_outreach_listing_id ON remarketing_outreach(listing_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_outreach_buyer_id ON remarketing_outreach(buyer_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_outreach_status ON remarketing_outreach(status);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_remarketing_outreach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_remarketing_outreach_updated_at
  BEFORE UPDATE ON remarketing_outreach
  FOR EACH ROW
  EXECUTE FUNCTION update_remarketing_outreach_updated_at();