
# Fix: Signup "Database error saving new user" 

## Root Cause

The signup process fails with a **500 error** because the `handle_new_user` database trigger references a column called `success` in the `trigger_logs` table, but that column does not exist. The actual column is named `status` (text type).

When a new user signs up, Supabase calls the `handle_new_user` trigger to create a profile. At the end of that trigger (and in its error handler), it tries to log the result:

```sql
-- Line that fails:
INSERT INTO public.trigger_logs (trigger_name, user_id, success, details) ...
```

Since `success` doesn't exist, the INSERT fails, which aborts the entire transaction -- including the profile creation AND the auth user creation. This is why signup is completely broken.

## The Fix

Run a SQL migration to add the missing `success` column to the `trigger_logs` table. This is a single-line database change:

```sql
ALTER TABLE public.trigger_logs ADD COLUMN success boolean DEFAULT true;
```

This will:
1. Add the `success` column the trigger expects
2. Allow the trigger to log its results without error
3. Unblock all signups immediately

## Important Notes

- **No code changes are needed** -- the frontend signup code is correct. The issue is entirely in the database schema.
- This fix needs to be applied to the **Live** database as well (since signups are happening on production). You can do this from Cloud View > Run SQL with "Live" selected.
- Existing rows in `trigger_logs` will get `success = true` as a default, which is harmless since those rows use the `status` text column.

## Steps

1. Run the `ALTER TABLE` migration to add the `success` column
2. Verify signup works by testing end-to-end
3. Publish and apply the same migration to the Live database
