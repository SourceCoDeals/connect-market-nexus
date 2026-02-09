

# Fix: Signup Broken Due to Missing `role` Column in `profiles` Table

## Root Cause (Confirmed)

The `handle_new_user` database trigger function tries to INSERT into a **`role`** column on the `profiles` table (line 241 of the trigger), but **that column does not exist** in the table schema.

The relevant line in the trigger:
```sql
INSERT INTO public.profiles (
  ...
  role,        -- LINE 241: THIS COLUMN DOES NOT EXIST
  ...
) VALUES (
  ...
  'buyer',     -- Hardcoded value for role
  ...
)
```

The `profiles` table has `buyer_type` and `buyer_role` columns, but no plain `role` column. This causes a fatal error that aborts the entire signup transaction, preventing both the profile creation AND the auth user record from being saved.

Our two previous fixes (adding `success` and `details` columns to `trigger_logs`) were necessary but did not resolve this deeper issue -- the trigger hits the `role` error first, then its EXCEPTION handler tries to log to `trigger_logs`, which previously also failed. Now that `trigger_logs` is fixed, the error handler works, but it still raises the original error via `RAISE`, so signup still fails.

## The Fix

A single database migration that does two things:

1. **Add the missing `role` column** to the `profiles` table:
   ```sql
   ALTER TABLE public.profiles 
     ADD COLUMN IF NOT EXISTS role text DEFAULT 'buyer';
   ```

2. **Backfill existing rows** so they all have a sensible default:
   ```sql
   UPDATE public.profiles 
     SET role = 'buyer' 
     WHERE role IS NULL;
   ```

## Why This Is the Right Fix

The alternative would be to rewrite the trigger function to remove the `role` reference, but:
- The trigger is massive (~420 lines) and is the core of the signup flow
- `role` is referenced in other parts of the codebase (`NonMarketplaceUsersTable.tsx`, the `User` type, etc.)
- Adding the column is non-destructive and aligns with what the trigger and frontend both expect

## Steps

1. Run a SQL migration to add the `role` column to `profiles` with a default of `'buyer'`
2. Backfill existing rows
3. Publish to push the migration to the Live database
4. Test signup end-to-end

## Technical Details

- **Files changed**: One new SQL migration file only. No frontend code changes needed.
- **Risk**: Very low -- this is adding a column with a default value, which is a non-blocking operation in PostgreSQL.
- **Downstream impact**: The `User` type in the frontend already expects a `role` field, so this will also fix any places where `user.role` was returning `undefined`.
