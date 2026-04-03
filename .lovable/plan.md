

# Fix: "Failed to dismiss" — RLS Policy Missing WITH CHECK

## Root Cause

The `document_requests` table has RLS enabled with an `ALL` policy for admins:

```
cmd: ALL
qual (USING): is_admin(auth.uid())
with_check: NULL
```

While PostgreSQL documentation says a missing `WITH CHECK` should default to the `USING` expression, Supabase's PostgREST layer can behave differently — an `ALL` policy without an explicit `WITH CHECK` may silently block `UPDATE` operations, returning zero rows affected (which Supabase treats as success with no error, but can also manifest as permission errors depending on the client).

The fix: replace the single `ALL` policy with explicit `SELECT` and `UPDATE` policies for admins, both with proper clauses.

## Migration

```sql
DROP POLICY IF EXISTS "Admins can manage all document requests" ON public.document_requests;

CREATE POLICY "Admins can select all document requests"
  ON public.document_requests FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all document requests"
  ON public.document_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete all document requests"
  ON public.document_requests FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert document requests"
  ON public.document_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
```

## Also: Surface actual error in toast

Update the catch block in `DismissButton` to log and display the actual error message instead of a generic "Failed to dismiss", so future issues are easier to debug.

### Files changed
- New SQL migration (RLS policy fix)
- `src/pages/admin/DocumentTrackingPage.tsx` — improve error logging in dismiss catch block

