-- Force PostgREST to reload schema cache so new columns are recognized
NOTIFY pgrst, 'reload schema';