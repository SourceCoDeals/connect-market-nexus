-- Create bucket for buyer transcript uploads
insert into storage.buckets (id, name, public)
values ('buyer-transcripts', 'buyer-transcripts', false)
on conflict (id) do nothing;

-- Storage policies for authenticated app users (admins) to manage buyer transcripts
-- Note: storage.objects already has RLS enabled by Supabase.

do $$
begin
  -- SELECT
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' 
      and tablename = 'objects' 
      and policyname = 'Buyer transcripts: authenticated can read'
  ) then
    create policy "Buyer transcripts: authenticated can read"
    on storage.objects
    for select
    using (bucket_id = 'buyer-transcripts' and auth.role() = 'authenticated');
  end if;

  -- INSERT
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' 
      and tablename = 'objects' 
      and policyname = 'Buyer transcripts: authenticated can upload'
  ) then
    create policy "Buyer transcripts: authenticated can upload"
    on storage.objects
    for insert
    with check (bucket_id = 'buyer-transcripts' and auth.role() = 'authenticated');
  end if;

  -- UPDATE
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' 
      and tablename = 'objects' 
      and policyname = 'Buyer transcripts: authenticated can update'
  ) then
    create policy "Buyer transcripts: authenticated can update"
    on storage.objects
    for update
    using (bucket_id = 'buyer-transcripts' and auth.role() = 'authenticated')
    with check (bucket_id = 'buyer-transcripts' and auth.role() = 'authenticated');
  end if;

  -- DELETE
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' 
      and tablename = 'objects' 
      and policyname = 'Buyer transcripts: authenticated can delete'
  ) then
    create policy "Buyer transcripts: authenticated can delete"
    on storage.objects
    for delete
    using (bucket_id = 'buyer-transcripts' and auth.role() = 'authenticated');
  end if;
end $$;
