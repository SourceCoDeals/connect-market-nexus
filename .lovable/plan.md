

# Plan: Create `incoming_leads` Table and `receive-valuation-lead` Edge Function

## 1. Database Migration

Create `incoming_leads` table with the specified columns. Add a unique constraint on `email` to support upsert. RLS will allow service-role inserts only (the edge function uses the service role key).

```sql
CREATE TABLE public.incoming_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_lead_id text,
  full_name text NOT NULL,
  email text NOT NULL,
  website text NOT NULL,
  lead_source text,
  calculator_inputs jsonb NOT NULL,
  valuation_result jsonb NOT NULL,
  ip_address text,
  city text,
  region text,
  country text,
  country_code text,
  created_at timestamptz DEFAULT now(),
  received_at timestamptz DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.incoming_leads ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY "Admins can manage incoming_leads"
  ON public.incoming_leads FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));
```

## 2. Edge Function: `receive-valuation-lead`

- File: `supabase/functions/receive-valuation-lead/index.ts`
- Config: `verify_jwt = false` in `supabase/config.toml`
- Validates required fields: `full_name`, `email`, `calculator_inputs`, `valuation_result`
- Upserts on `email` (ON CONFLICT UPDATE)
- Uses service role key for DB access
- Open CORS (allow all origins)
- Returns `{ success: true }` on success

## 3. Function URL

After deployment: `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/receive-valuation-lead`

