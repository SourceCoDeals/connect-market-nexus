-- Industry Score Adjustments - Based on User Feedback
-- These adjustments reflect real market dynamics where certain industries
-- have more active buyer pools even for smaller deals

-- Update Home Services (HVAC especially hot)
UPDATE industry_score_adjustments
SET
  score_adjustment = 10,
  notes = 'Hot market - residential HVAC has active buyers even for small deals. PE consolidators and strategics actively acquiring.',
  confidence = 'high',
  sample_size = 1,
  manually_set = true,
  updated_at = NOW()
WHERE industry = 'Home Services';

-- Add specific HVAC entry
INSERT INTO industry_score_adjustments (industry, score_adjustment, notes, confidence, manually_set)
VALUES ('HVAC', 12, 'Very hot market - residential HVAC especially desirable. Recurring revenue from maintenance contracts.', 'high', true)
ON CONFLICT (industry) DO UPDATE SET
  score_adjustment = 12,
  notes = 'Very hot market - residential HVAC especially desirable. Recurring revenue from maintenance contracts.',
  confidence = 'high',
  manually_set = true,
  updated_at = NOW();

-- Update Automotive (collision/repair have active buyer market)
UPDATE industry_score_adjustments
SET
  score_adjustment = 12,
  notes = 'Active buyer market for single shops. Auto repair needs $1.2M+ revenue, collision needs $2.5M+ per location to be sellable. Many PE-backed consolidators.',
  confidence = 'high',
  sample_size = 1,
  manually_set = true,
  updated_at = NOW()
WHERE industry = 'Automotive';

-- Add specific collision repair entry
INSERT INTO industry_score_adjustments (industry, score_adjustment, notes, confidence, manually_set)
VALUES ('Collision Repair', 15, 'Very active consolidation market. Caliber, Crash Champions, Classic Collision actively acquiring. $2.5M+ revenue per location preferred.', 'high', true)
ON CONFLICT (industry) DO UPDATE SET
  score_adjustment = 15,
  notes = 'Very active consolidation market. Caliber, Crash Champions, Classic Collision actively acquiring. $2.5M+ revenue per location preferred.',
  confidence = 'high',
  manually_set = true,
  updated_at = NOW();

INSERT INTO industry_score_adjustments (industry, score_adjustment, notes, confidence, manually_set)
VALUES ('Auto Repair', 10, 'Active market for quality shops. $1.2M+ revenue threshold for sellability. MSO consolidators interested.', 'high', true)
ON CONFLICT (industry) DO UPDATE SET
  score_adjustment = 10,
  notes = 'Active market for quality shops. $1.2M+ revenue threshold for sellability. MSO consolidators interested.',
  confidence = 'high',
  manually_set = true,
  updated_at = NOW();

-- Update Construction (new construction less desirable)
UPDATE industry_score_adjustments
SET
  score_adjustment = -5,
  margin_threshold_adjustment = -0.05, -- Lower margin expectations for construction
  notes = 'New construction less desirable than service/renovation. Cyclical, project-based revenue. Service-focused construction companies score higher.',
  confidence = 'high',
  sample_size = 1,
  manually_set = true,
  updated_at = NOW()
WHERE industry = 'Construction';

-- Add service-focused construction (more desirable)
INSERT INTO industry_score_adjustments (industry, score_adjustment, notes, confidence, manually_set)
VALUES ('Construction Services', 5, 'Service/renovation focused construction more desirable than new construction. More recurring revenue potential.', 'high', true)
ON CONFLICT (industry) DO UPDATE SET
  score_adjustment = 5,
  notes = 'Service/renovation focused construction more desirable than new construction. More recurring revenue potential.',
  confidence = 'high',
  manually_set = true,
  updated_at = NOW();

-- Add other known hot industries
INSERT INTO industry_score_adjustments (industry, score_adjustment, notes, confidence, manually_set)
VALUES
  ('Plumbing', 10, 'Hot market - essential services with recurring revenue from maintenance. Active consolidation.', 'high', true),
  ('Electrical', 8, 'Solid market - commercial electrical especially desirable. Good margins.', 'high', true),
  ('Pest Control', 12, 'Very hot - recurring revenue model. Rollins, Rentokil, and PE actively acquiring.', 'high', true),
  ('Landscaping', 6, 'Moderate market - commercial contracts more valuable. Seasonal considerations.', 'medium', true),
  ('Roofing', 5, 'Active market for commercial roofing. Residential more cyclical.', 'medium', true),
  ('Fire Protection', 10, 'Hot market - inspection/testing recurring revenue highly valued.', 'high', true),
  ('Security Systems', 8, 'Good market - RMR (recurring monthly revenue) valued at premium.', 'high', true)
ON CONFLICT (industry) DO NOTHING;

-- Add IT/MSP (hot market)
INSERT INTO industry_score_adjustments (industry, score_adjustment, notes, confidence, manually_set)
VALUES ('IT Services', 8, 'Active market for MSPs with MRR. ConnectWise, Kaseya ecosystem valuations strong.', 'high', true)
ON CONFLICT (industry) DO UPDATE SET
  score_adjustment = 8,
  notes = 'Active market for MSPs with MRR. ConnectWise, Kaseya ecosystem valuations strong.',
  confidence = 'high',
  manually_set = true,
  updated_at = NOW();

-- Healthcare services (varies by specialty)
INSERT INTO industry_score_adjustments (industry, score_adjustment, notes, confidence, manually_set)
VALUES
  ('Dental', 10, 'Hot DSO market. Heartland, Aspen, PE-backed groups actively acquiring.', 'high', true),
  ('Veterinary', 12, 'Very hot - Mars (VCA, Banfield), NVA, and many PE groups competing.', 'high', true),
  ('Physical Therapy', 6, 'Moderate consolidation activity. Upstream, ATI active buyers.', 'medium', true),
  ('Home Health', 8, 'Aging demographics driving demand. PE interest strong.', 'high', true)
ON CONFLICT (industry) DO NOTHING;
