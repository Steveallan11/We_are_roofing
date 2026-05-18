alter table public.quotes
  add column if not exists options jsonb not null default '[]'::jsonb,
  add column if not exists accepted_option_id text;

create table if not exists public.quote_messages (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'admin')),
  sender_name text,
  sender_email text,
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

alter table public.quote_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quote_messages'
      and policyname = 'Admin access quote messages'
  ) then
    create policy "Admin access quote messages"
      on public.quote_messages
      for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quote_messages'
      and policyname = 'Customer can send quote message'
  ) then
    create policy "Customer can send quote message"
      on public.quote_messages
      for insert
      with check (sender_type = 'customer');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quote_messages'
      and policyname = 'Customer can read quote thread'
  ) then
    create policy "Customer can read quote thread"
      on public.quote_messages
      for select
      using (true);
  end if;
end $$;

alter table public.materials
  add column if not exists unit_cost numeric(12,2),
  add column if not exists total_cost numeric(12,2),
  add column if not exists actual_price numeric(12,2),
  add column if not exists margin_pct numeric(8,2),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  website text,
  account_ref text,
  notes text,
  categories text[] default '{}',
  is_preferred boolean default false,
  created_at timestamptz default now()
);

alter table public.suppliers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'suppliers'
      and policyname = 'Admin access suppliers'
  ) then
    create policy "Admin access suppliers"
      on public.suppliers
      for all
      using (auth.role() = 'authenticated');
  end if;
end $$;

create table if not exists public.material_suppliers (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materials(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  supplier_sku text,
  unit_price numeric(12,2),
  lead_days int,
  last_quoted date,
  is_preferred boolean default false,
  notes text,
  unique(material_id, supplier_id)
);

alter table public.material_suppliers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'material_suppliers'
      and policyname = 'Admin access material suppliers'
  ) then
    create policy "Admin access material suppliers"
      on public.material_suppliers
      for all
      using (auth.role() = 'authenticated');
  end if;
end $$;

alter table public.pricing_rules
  add column if not exists preferred_supplier_id uuid references public.suppliers(id);
