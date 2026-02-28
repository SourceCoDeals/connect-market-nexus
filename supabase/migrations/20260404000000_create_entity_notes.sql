-- Notes history for deals and buyers
create table if not exists public.entity_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('deal', 'buyer')),
  entity_id uuid not null,
  note_text text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookups by entity
create index if not exists idx_entity_notes_entity
  on public.entity_notes (entity_type, entity_id, created_at desc);

-- RLS
alter table public.entity_notes enable row level security;

create policy "Admins can manage entity notes"
  on public.entity_notes for all
  using (true)
  with check (true);
