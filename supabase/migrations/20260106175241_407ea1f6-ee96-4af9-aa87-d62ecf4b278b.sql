
-- Update Alex Gilbert's profile with all recovered data from auth.users.raw_user_meta_data
UPDATE public.profiles
SET
  first_name = 'Alex',
  last_name = 'Gilbert',
  company = 'Gilbert Group',
  job_title = 'President',
  phone_number = '5734243098',
  website = 'https://gilbertgroup.biz',
  buyer_type = 'individual',
  business_categories = '["Manufacturing", "Professional Services", "Construction", "Transportation & Logistics", "Chemicals", "Consumer Goods", "Infrastructure", "Government Services", "Waste Management", "Textiles & Apparel", "Home Services", "Industrial Equipment"]'::jsonb,
  target_locations = '["Midwest US"]'::jsonb,
  geographic_focus = '["Midwest US"]'::jsonb,
  ideal_target_description = 'Primarily acquiring main street businesses, lower middle market to high lower market range.',
  specific_business_search = '500k min EBITA, Midwest, In business for 3+ years, steady or increasing revenue, main street business',
  funding_source = 'personal_savings',
  max_equity_today_band = '1_2m',
  uses_bank_finance = 'not_sure',
  deal_intent = 'primarily_addons',
  deal_sourcing_methods = '["brokers_bankers", "proprietary_outreach", "buy_side_firms", "databases"]'::jsonb,
  referral_source = 'linkedin',
  referral_source_detail = 'Post',
  target_acquisition_volume = '1_2',
  email_verified = true,
  updated_at = now()
WHERE id = 'cff272b9-c2e4-4804-8189-0fdc60392b23';
