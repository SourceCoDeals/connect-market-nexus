-- Create deal sourcing requests table
create table public.deal_sourcing_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  buyer_type text,
  business_categories text[],
  target_locations text[],
  revenue_min text,
  revenue_max text,
  investment_thesis text,
  additional_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.deal_sourcing_requests enable row level security;

-- Users can view their own requests
create policy "Users can view own requests"
  on public.deal_sourcing_requests
  for select
  using (auth.uid() = user_id);

-- Users can insert their own requests
create policy "Users can insert own requests"
  on public.deal_sourcing_requests
  for insert
  with check (auth.uid() = user_id);

-- Admins can view all requests
create policy "Admins can view all requests"
  on public.deal_sourcing_requests
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

-- Admins can manage all requests
create policy "Admins can manage all requests"
  on public.deal_sourcing_requests
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );