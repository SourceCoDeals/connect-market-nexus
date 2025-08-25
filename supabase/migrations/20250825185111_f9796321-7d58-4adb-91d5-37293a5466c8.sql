-- Fix data integrity issues across all profiles

-- 1. Fix revenue ranges that are still numeric (should be string labels)
UPDATE public.profiles
SET 
  revenue_range_min = CASE 
    WHEN revenue_range_min = '0' THEN 'Under $1M'
    WHEN revenue_range_min = '500000' THEN 'Under $1M'
    WHEN revenue_range_min = '1500000' THEN '$1M - $5M'
    WHEN revenue_range_min = '5000000' THEN '$5M - $10M'
    WHEN revenue_range_min = '10000000' THEN '$10M - $25M'
    WHEN revenue_range_min = '10' THEN '$10M - $25M'  -- Likely encoded incorrectly
    ELSE revenue_range_min
  END,
  revenue_range_max = CASE 
    WHEN revenue_range_max = '0' THEN 'Under $1M'
    WHEN revenue_range_max = '1000000' THEN '$1M - $5M'
    WHEN revenue_range_max = '2500000' THEN '$1M - $5M'
    WHEN revenue_range_max = '10000000' THEN '$10M - $25M'
    WHEN revenue_range_max = '50000000' THEN '$25M - $50M'
    WHEN revenue_range_max = '100000000' THEN '$50M - $100M'
    WHEN revenue_range_max = '1000000000' THEN 'Over $100M'
    WHEN revenue_range_max = '100' THEN '$50M - $100M'  -- Likely encoded incorrectly
    ELSE revenue_range_max
  END,
  updated_at = now()
WHERE 
  revenue_range_min ~ '^[0-9]+$' OR 
  revenue_range_max ~ '^[0-9]+$';

-- 2. Fix fund_size and AUM values that have inconsistent formats
UPDATE public.profiles
SET 
  fund_size = CASE 
    WHEN fund_size = '0' THEN NULL
    WHEN fund_size = 'NA' THEN NULL
    WHEN fund_size ~ '^[0-9,]+$' AND length(replace(fund_size, ',', '')) >= 9 THEN 'Over $1B'
    WHEN fund_size ~ '^[0-9,]+$' AND length(replace(fund_size, ',', '')) >= 6 THEN 
      CASE 
        WHEN replace(fund_size, ',', '')::bigint >= 500000000 THEN '$500M - $1B'
        WHEN replace(fund_size, ',', '')::bigint >= 100000000 THEN '$100M - $500M'
        WHEN replace(fund_size, ',', '')::bigint >= 50000000 THEN '$50M - $100M'
        WHEN replace(fund_size, ',', '')::bigint >= 10000000 THEN '$10M - $50M'
        ELSE 'Under $10M'
      END
    ELSE fund_size
  END,
  aum = CASE 
    WHEN aum = 'NA' THEN NULL
    WHEN aum = '46' THEN '$10M - $50M'  -- Likely encoded as millions
    WHEN aum ~ '^[0-9,]+$' AND length(replace(aum, ',', '')) >= 9 THEN 'Over $1B'
    WHEN aum ~ '^[0-9,]+$' AND length(replace(aum, ',', '')) >= 6 THEN 
      CASE 
        WHEN replace(aum, ',', '')::bigint >= 500000000 THEN '$500M - $1B'
        WHEN replace(aum, ',', '')::bigint >= 100000000 THEN '$100M - $500M'
        WHEN replace(aum, ',', '')::bigint >= 50000000 THEN '$50M - $100M'
        WHEN replace(aum, ',', '')::bigint >= 10000000 THEN '$10M - $50M'
        ELSE 'Under $10M'
      END
    ELSE aum
  END,
  updated_at = now()
WHERE 
  fund_size IS NOT NULL OR 
  aum IS NOT NULL;

-- 3. Ensure industry_expertise is properly formatted (convert null to empty array)
UPDATE public.profiles
SET 
  industry_expertise = '[]'::jsonb,
  updated_at = now()
WHERE 
  industry_expertise IS NULL;