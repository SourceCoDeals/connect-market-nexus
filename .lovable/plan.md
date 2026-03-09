

# Fix: Outreach Profile Save Failing (RLS Policy Mismatch)

## Root Cause

The `deal_outreach_profiles` table's RLS policy checks `profiles.role = 'admin'`, but **no profiles have `role = 'admin'`** — all profiles have `role = 'buyer'`. The rest of the application uses `is_admin(auth.uid())`, which checks the `user_roles` table (where admin users do exist). This is a policy mismatch introduced when the table was created.

## Fix

**One migration** to replace the RLS policy:

- Drop the existing policy `"Admins can manage deal outreach profiles"`
- Create a new policy using `is_admin(auth.uid())` consistent with every other admin-gated table in the project

```sql
DROP POLICY IF EXISTS "Admins can manage deal outreach profiles" ON public.deal_outreach_profiles;

CREATE POLICY "Admins can manage deal outreach profiles"
  ON public.deal_outreach_profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
```

No frontend code changes needed.

