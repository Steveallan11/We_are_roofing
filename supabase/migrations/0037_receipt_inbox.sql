create table if not exists public.receipt_inbox (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'assigned')),
  display_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size integer,
  supplier_name text,
  description text,
  category text not null default 'other'
    check (category in ('materials','labour','subcontractor','plant_hire','skip_hire','scaffolding','fuel','waste','other')),
  amount numeric(12,2),
  vat_amount numeric(12,2) not null default 0,
  expense_date date not null default current_date,
  notes text,
  assigned_job_id uuid references public.jobs(id) on delete set null,
  assigned_expense_id uuid references public.job_expenses(id) on delete set null,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receipt_inbox_status_idx
  on public.receipt_inbox (business_id, status, created_at desc);

create index if not exists receipt_inbox_assigned_job_idx
  on public.receipt_inbox (assigned_job_id)
  where assigned_job_id is not null;

alter table public.receipt_inbox enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'receipt_inbox'
      and policyname = 'Authenticated admin access receipt inbox'
  ) then
    create policy "Authenticated admin access receipt inbox"
      on public.receipt_inbox
      for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
