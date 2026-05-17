alter table public.businesses add column if not exists weather_location text default 'Yateley';
alter table public.businesses add column if not exists bank_name text;
alter table public.businesses add column if not exists bank_sort_code text;
alter table public.businesses add column if not exists bank_account text;
alter table public.businesses add column if not exists bank_account_name text;

alter table public.pricing_rules add column if not exists rule_name text;
alter table public.pricing_rules add column if not exists rule_type text;
alter table public.pricing_rules add column if not exists conditions jsonb not null default '{}'::jsonb;
alter table public.pricing_rules add column if not exists flat_adjustment numeric(12,2);
alter table public.pricing_rules add column if not exists active boolean not null default true;

create unique index if not exists pricing_rules_business_rule_name_type_idx
  on public.pricing_rules (business_id, rule_name, rule_type);

create table if not exists public.completion_certificates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  business_id uuid references public.businesses(id),
  certificate_ref text,
  completed_at timestamptz,
  guarantee_years int default 10,
  works_summary text,
  pdf_url text,
  created_at timestamptz default now()
);

alter table public.completion_certificates enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'completion_certificates'
      and policyname = 'Admin access completion certificates'
  ) then
    create policy "Admin access completion certificates"
      on public.completion_certificates
      for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
