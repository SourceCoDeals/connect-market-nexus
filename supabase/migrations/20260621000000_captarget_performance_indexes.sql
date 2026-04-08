-- Performance indexes for CapTarget leads page
-- The main query filters by deal_source='captarget' and sorts by captarget_contact_date DESC.
-- Without a composite index, Postgres must scan all matching rows then sort in memory.

-- Composite index: covers the WHERE + ORDER BY in a single B-tree scan
CREATE INDEX IF NOT EXISTS idx_listings_captarget_contact_date
  ON listings (deal_source, captarget_contact_date DESC NULLS LAST);

-- Partial index for active/inactive status tab filtering
CREATE INDEX IF NOT EXISTS idx_listings_captarget_status
  ON listings (captarget_status)
  WHERE deal_source = 'captarget';

-- Partial index for "hide not-a-fit" filter (on by default)
CREATE INDEX IF NOT EXISTS idx_listings_remarketing_status_captarget
  ON listings (remarketing_status)
  WHERE deal_source = 'captarget';

-- Partial index for "hide pushed" filter
CREATE INDEX IF NOT EXISTS idx_listings_pushed_captarget
  ON listings (pushed_to_all_deals)
  WHERE deal_source = 'captarget';
