
-- Drop the two older overloads (24-param and 26-param), keeping only the complete 43-param version

-- 1) Drop the original 24-param version
DROP FUNCTION IF EXISTS public.merge_valuation_lead(
  text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric,
  text, text, text, text, text, integer,
  text, text, jsonb, jsonb, jsonb
);

-- 2) Drop the 26-param version (added exit_timing + open_to_intros but same incomplete body)
DROP FUNCTION IF EXISTS public.merge_valuation_lead(
  text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, numeric,
  text, text, text, text, text, integer,
  text, text, jsonb, jsonb, jsonb,
  text, boolean
);
