-- Job finance: expense tracking per job + invoice types (deposit / interim / final)

create table if not exists public.job_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  category text not null default 'other' check (category in ('materials','labour','subcontractor','plant_hire','skip_hire','scaffolding','fuel','waste','other')),
  description text not null,
  supplier_name text,
  amount numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  expense_date date not null default current_date,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_expenses_job_idx on public.job_expenses (job_id);
create index if not exists job_expenses_business_idx on public.job_expenses (business_id);
create index if not exists job_expenses_date_idx on public.job_expenses (expense_date desc);

alter table public.job_expenses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'job_expenses' and policyname = 'Authenticated admin access job_expenses'
  ) then
    create policy "Authenticated admin access job_expenses"
      on public.job_expenses for all
      using (auth.role() = 'authenticated');
  end if;
end $$;

-- Invoice type: standard (full quote), deposit, interim stage, or final balance
alter table public.invoices
  add column if not exists invoice_type text not null default 'standard'
  check (invoice_type in ('standard','deposit','interim','final'));

create index if not exists invoices_type_idx on public.invoices (invoice_type);
