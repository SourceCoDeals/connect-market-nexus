-- Data update: Agellus Capital + 4 platform companies + Dominic Lupo profile
-- 1) Update Agellus PE firm record (firm-wide truth only)
UPDATE public.buyers
SET 
  buyer_type = 'private_equity',
  pe_firm_name = 'Agellus Capital',
  pe_firm_website = 'https://www.agellus.com/',
  is_pe_backed = false,
  num_platforms = 4,
  notes = COALESCE(notes || E'\n\n', '') || 'April 2026: Dominic Lupo confirmed current portfolio is HighGrove (landscaping), Titan Restoration, Bluejack Fire & Life Safety, CompassMSP. Per-platform add-on criteria captured on each platform record.',
  data_last_updated = now()
WHERE id = '48c2df7d-3a09-48fb-88ab-c29fb9e5d84a';

-- 2) Insert HighGrove Partners
INSERT INTO public.buyers (
  company_name, company_website, platform_website, buyer_type, is_pe_backed,
  parent_pe_firm_id, parent_pe_firm_name, industry_vertical,
  target_ebitda_min, target_geographies, target_services,
  primary_customer_size, customer_industries, revenue_model,
  thesis_summary, acquisition_appetite, verification_status, data_last_updated, archived
) VALUES (
  'HighGrove Partners',
  'https://www.highgrove.net/',
  'https://www.highgrove.net/',
  'corporate',
  true,
  '48c2df7d-3a09-48fb-88ab-c29fb9e5d84a',
  'Agellus Capital',
  'Commercial Landscaping',
  1000000,
  ARRAY['TX','VA','FL','GA','NW GA','North/Central FL'],
  ARRAY['landscaping','tree care'],
  'Commercial',
  ARRAY['Commercial'],
  '50%+ recurring',
  'Commercial Landscaping: Any landscaping and tree care add-ons north of $1mm ebitda in the SE US (TX > VA > FL triangle) providing 50%+ reoccurring services to predominantly commercial customers. For deals within NW GA, North/Central FL, or VA, we can go even smaller than $1mm ebitda.',
  'Active add-on acquirer for Agellus platform',
  'verified',
  now(),
  false
);

-- 3) Insert Titan Restoration
INSERT INTO public.buyers (
  company_name, company_website, platform_website, buyer_type, is_pe_backed,
  parent_pe_firm_id, parent_pe_firm_name, industry_vertical,
  target_ebitda_min, target_geographies, target_services,
  primary_customer_size, customer_industries, revenue_model,
  thesis_summary, acquisition_appetite, verification_status, data_last_updated, archived
) VALUES (
  'Titan Restoration',
  'https://titan911.com/',
  'https://titan911.com/',
  'corporate',
  true,
  '48c2df7d-3a09-48fb-88ab-c29fb9e5d84a',
  'Agellus Capital',
  'Commercial Restoration',
  1000000,
  ARRAY['TX','CO','WY','MT','NM','AZ','UT','ID','NV','CA','OR','WA'],
  ARRAY['restoration','remediation','mitigation'],
  'Commercial',
  ARRAY['Commercial (low storm/insurance exposure)'],
  '<50% insurance exposure',
  'Commercial Restoration: Any restoration, remediation, mitigation add-ons north of $1mm ebitda in the SW and MW US (Inclusive of TX, CO, WY, MT and every state west of that), serving predominately commercial customers with little storm exposure, less than 50% insurance exposure.',
  'Active add-on acquirer for Agellus platform',
  'verified',
  now(),
  false
);

-- 4) Insert Bluejack Fire & Life Safety
INSERT INTO public.buyers (
  company_name, company_website, platform_website, buyer_type, is_pe_backed,
  parent_pe_firm_id, parent_pe_firm_name, industry_vertical,
  target_ebitda_min, target_geographies, target_services,
  revenue_model,
  thesis_summary, acquisition_appetite, verification_status, data_last_updated, archived
) VALUES (
  'Bluejack Fire & Life Safety',
  'https://bluejackfire.com/',
  'https://bluejackfire.com/',
  'corporate',
  true,
  '48c2df7d-3a09-48fb-88ab-c29fb9e5d84a',
  'Agellus Capital',
  'Fire & Life Safety',
  2500000,
  ARRAY['CA','NY','TX','New geographies'],
  ARRAY['fire safety testing','inspection','maintenance','install'],
  '33%+ recurring',
  'Fire & Life Safety: Any fire safety testing & inspection, maintenance, and install add-ons with $2.5mm+ ebitda for new geographies with 33%+ reoccurring services. For our existing geographies (CA, NY, TX) we can go significantly smaller than the $2.5mm ebitda threshold.',
  'Active add-on acquirer for Agellus platform',
  'verified',
  now(),
  false
);

-- 5) Insert CompassMSP
INSERT INTO public.buyers (
  company_name, company_website, platform_website, buyer_type, is_pe_backed,
  parent_pe_firm_id, parent_pe_firm_name, industry_vertical,
  target_ebitda_min, target_geographies, target_services,
  primary_customer_size, customer_industries, revenue_model,
  thesis_summary, acquisition_appetite, verification_status, data_last_updated, archived
) VALUES (
  'CompassMSP',
  'https://compassmsp.com/',
  'https://compassmsp.com/',
  'corporate',
  true,
  '48c2df7d-3a09-48fb-88ab-c29fb9e5d84a',
  'Agellus Capital',
  'IT Managed Services',
  800000,
  ARRAY['United States','Canada'],
  ARRAY['managed cyber','cloud','compliance','desktop'],
  'SMB',
  ARRAY['SMB'],
  '60%+ recurring',
  'IT Managed Services: Any IT managed cyber, cloud, compliance, desktop add-ons north of $800k ebitda based in the US or Canada that are 60%+ recurring serving SMB end market customers.',
  'Active add-on acquirer for Agellus platform',
  'verified',
  now(),
  false
);

-- 6) Update Dominic Lupo's marketplace profile
UPDATE public.profiles
SET 
  portfolio_company_addon = 'HighGrove Partners, Titan Restoration, Bluejack Fire & Life Safety, CompassMSP',
  mandate_blurb = 'Agellus Capital PE platform. Active add-on acquirer across 4 platforms: commercial landscaping (HighGrove, $1M+ EBITDA, SE US), commercial restoration (Titan, $1M+, SW/MW US), fire & life safety (Bluejack, $2.5M+, expanding from CA/NY/TX), IT managed services (CompassMSP, $800K+, US/Canada SMB).',
  updated_at = now()
WHERE id = 'bb5429be-6d22-4c21-9f84-829b4c97189b';