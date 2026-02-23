-- =============================================================================
-- Seed Data Script for Connect Market Nexus
-- =============================================================================
-- Run against your Supabase database:
--   psql -f scripts/seed-data.sql
--
-- All test UUIDs start with 00000000-test- for easy identification and cleanup.
-- To remove all seed data:
--   DELETE FROM connection_requests WHERE id LIKE '00000000-test-%';
--   DELETE FROM listings WHERE id LIKE '00000000-test-%';
--   DELETE FROM firm_agreements WHERE id LIKE '00000000-test-%';
--   DELETE FROM profiles WHERE id LIKE '00000000-test-%';
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Sample Profiles (3 users: admin, buyer, seller)
-- =============================================================================

-- Admin user: has full platform access
INSERT INTO profiles (
  id,
  first_name,
  last_name,
  email,
  email_verified,
  role,
  approval_status,
  is_admin,
  linkedin_profile,
  website,
  company,
  job_title,
  bio,
  created_at,
  updated_at
) VALUES (
  '00000000-test-0000-0000-000000000001',
  'Alex',
  'Admin',
  'alex.admin@example.com',
  true,
  'admin',
  'approved',
  true,
  'https://linkedin.com/in/alex-admin-test',
  'https://connectmarketnexus.com',
  'Connect Market Nexus',
  'Platform Administrator',
  'Test admin account for development and QA purposes.',
  NOW() - INTERVAL '90 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Buyer user: an active acquisition searcher
INSERT INTO profiles (
  id,
  first_name,
  last_name,
  email,
  email_verified,
  role,
  approval_status,
  is_admin,
  linkedin_profile,
  website,
  company,
  company_name,
  job_title,
  bio,
  buyer_type,
  buyer_role,
  deal_size_band,
  search_stage,
  geographic_focus,
  business_categories,
  target_deal_size_min,
  target_deal_size_max,
  onboarding_completed,
  nda_signed,
  fee_agreement_signed,
  created_at,
  updated_at
) VALUES (
  '00000000-test-0000-0000-000000000002',
  'Jordan',
  'Buyer',
  'jordan.buyer@example.com',
  true,
  'buyer',
  'approved',
  false,
  'https://linkedin.com/in/jordan-buyer-test',
  'https://acquirevest-capital.example.com',
  'AcquireVest Capital',
  'AcquireVest Capital',
  'Managing Director',
  'Search fund operator focused on B2B SaaS and business services in the lower middle market.',
  'search_fund',
  'searcher',
  '$1M - $5M',
  'active',
  '["Northeast US", "Southeast US"]',
  '["Business Services", "SaaS", "Healthcare IT"]',
  1000000,
  5000000,
  true,
  true,
  true,
  NOW() - INTERVAL '60 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Seller / business owner user
INSERT INTO profiles (
  id,
  first_name,
  last_name,
  email,
  email_verified,
  role,
  approval_status,
  is_admin,
  linkedin_profile,
  website,
  company,
  company_name,
  job_title,
  bio,
  owner_intent,
  owner_timeline,
  onboarding_completed,
  created_at,
  updated_at
) VALUES (
  '00000000-test-0000-0000-000000000003',
  'Morgan',
  'Seller',
  'morgan.seller@example.com',
  true,
  'owner',
  'approved',
  false,
  'https://linkedin.com/in/morgan-seller-test',
  'https://greenfield-hvac.example.com',
  'Greenfield HVAC Solutions',
  'Greenfield HVAC Solutions',
  'Founder & CEO',
  'Founded Greenfield HVAC 20 years ago. Exploring strategic options including a full sale.',
  'full_sale',
  '6_to_12_months',
  true,
  NOW() - INTERVAL '30 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. Sample Listings (2 realistic M&A deal listings)
-- =============================================================================

-- Listing 1: A profitable HVAC services company
INSERT INTO listings (
  id,
  title,
  description,
  status,
  industry,
  category,
  categories,
  revenue,
  ebitda,
  ebitda_margin,
  location,
  address_state,
  address_city,
  is_internal_deal,
  acquisition_type,
  business_model,
  full_time_employees,
  founded_year,
  customer_types,
  growth_trajectory,
  management_depth,
  seller_motivation,
  executive_summary,
  project_name,
  deal_source,
  created_at,
  updated_at
) VALUES (
  '00000000-test-0000-0000-000000000010',
  'Established HVAC Services Company - Southeast US',
  'Well-established commercial and residential HVAC services provider with 20+ years of operating history. Strong recurring revenue from maintenance contracts and growing installation pipeline. Owner-operated with experienced management team in place.',
  'published',
  'Home Services',
  'HVAC',
  ARRAY['Home Services', 'HVAC', 'Mechanical Contractors'],
  4200000,
  840000,
  20.0,
  'Charlotte, NC',
  'NC',
  'Charlotte',
  false,
  'full_sale',
  'Recurring services + project-based installation',
  35,
  2004,
  'Commercial property managers, residential homeowners',
  'Stable with upside',
  'Strong - tenured operations manager and lead technicians',
  'Retirement after 20 years of ownership',
  'Profitable HVAC services business with $4.2M revenue, 20% EBITDA margins, and a loyal customer base across the Charlotte metro area. Significant recurring revenue from 500+ maintenance contracts provides downside protection.',
  'Project Evergreen',
  'direct_outreach',
  NOW() - INTERVAL '14 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Listing 2: A B2B SaaS platform
INSERT INTO listings (
  id,
  title,
  description,
  status,
  industry,
  category,
  categories,
  revenue,
  ebitda,
  ebitda_margin,
  location,
  address_state,
  address_city,
  is_internal_deal,
  acquisition_type,
  business_model,
  full_time_employees,
  founded_year,
  customer_types,
  growth_trajectory,
  management_depth,
  seller_motivation,
  executive_summary,
  project_name,
  deal_source,
  created_at,
  updated_at
) VALUES (
  '00000000-test-0000-0000-000000000011',
  'B2B SaaS Platform - Compliance & Workflow Automation',
  'Cloud-based compliance and workflow automation platform serving mid-market financial services firms. 95% gross retention rate with net revenue retention above 110%. Fully remote team with product-led growth motion and strong unit economics.',
  'published',
  'Technology',
  'SaaS',
  ARRAY['Technology', 'SaaS', 'Financial Services', 'Compliance'],
  2800000,
  700000,
  25.0,
  'Austin, TX',
  'TX',
  'Austin',
  false,
  'majority_recapitalization',
  'SaaS - annual and monthly subscriptions',
  22,
  2018,
  'Mid-market banks, credit unions, insurance carriers',
  'High growth - 35% YoY',
  'Moderate - CTO and VP Sales can operate independently',
  'Founder seeking growth capital partner for next phase of expansion',
  'High-growth SaaS platform with $2.8M ARR, 25% EBITDA margins, and exceptional retention metrics. Serves an underserved niche in financial services compliance automation with significant TAM remaining.',
  'Project Blueshift',
  'inbound',
  NOW() - INTERVAL '7 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3. Sample Firm Agreement (1 advisory/PE firm)
-- =============================================================================

INSERT INTO firm_agreements (
  id,
  primary_company_name,
  normalized_company_name,
  email_domain,
  website_domain,
  member_count,
  nda_signed,
  nda_status,
  fee_agreement_signed,
  fee_agreement_status,
  created_at,
  updated_at
) VALUES (
  '00000000-test-0000-0000-000000000020',
  'AcquireVest Capital',
  'acquirevest capital',
  'acquirevest-capital.example.com',
  'acquirevest-capital.example.com',
  3,
  true,
  'signed',
  true,
  'signed',
  NOW() - INTERVAL '45 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. Sample Connection Request (buyer requesting access to listing)
-- =============================================================================

-- Jordan Buyer requests access to the HVAC listing
INSERT INTO connection_requests (
  id,
  user_id,
  listing_id,
  status,
  user_message,
  firm_id,
  source,
  created_at,
  updated_at
) VALUES (
  '00000000-test-0000-0000-000000000030',
  '00000000-test-0000-0000-000000000002',
  '00000000-test-0000-0000-000000000010',
  'pending',
  'I am actively searching for HVAC and home services businesses in the Southeast. AcquireVest Capital has committed equity of $2M and I have relevant operating experience in field services. I would love to learn more about this opportunity.',
  '00000000-test-0000-0000-000000000020',
  'marketplace',
  NOW() - INTERVAL '2 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

COMMIT;
