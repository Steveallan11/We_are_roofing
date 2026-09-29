create table if not exists public.literature_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  display_name text not null,
  description text,
  storage_bucket text not null default 'job-documents',
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists literature_assets_business_idx
  on public.literature_assets (business_id, is_active, display_name);

alter table public.literature_assets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'literature_assets'
      and policyname = 'Authenticated admin access literature assets'
  ) then
    create policy "Authenticated admin access literature assets"
      on public.literature_assets for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
