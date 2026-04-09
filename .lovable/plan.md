

# Fix: Remove contact_assignments reference from migration SQL

## Problem
The migration `20260623000000_portal_security_fixes.sql` includes a section (lines 99-109) that tries to fix a foreign key on `contact_assignments`, but that table was never created in the database. The migration fails.

## Fix
Remove section 5 ("FIX: contact_assignments references deleted 'deals' table") from the migration SQL. The rest of the migration is valid and should run fine.

Specifically, remove these lines from the SQL before running it:

```sql
-- DELETE THESE LINES (99-109):
-- 5. FIX: contact_assignments references deleted 'deals' table
ALTER TABLE public.contact_assignments
  DROP CONSTRAINT IF EXISTS contact_assignments_deal_id_fkey;
ALTER TABLE public.contact_assignments
  ADD CONSTRAINT contact_assignments_deal_id_fkey
    FOREIGN KEY (deal_id) REFERENCES public.deal_pipeline(id) ON DELETE CASCADE;
```

## Also
Update the migration file in the codebase to match, so future applies don't hit this error.

| File | Change |
|------|--------|
| `supabase/migrations/20260623000000_portal_security_fixes.sql` | Remove lines 99-109 (contact_assignments FK fix) |

