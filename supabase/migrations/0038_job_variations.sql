-- Additional work / contract variations with customer approval and separate invoicing.

create table if not exists public.job_variations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  variation_ref text not null unique,
  title text not null,
  description text not null default '',
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  approval_required boolean not null default true,
  approval_method text check (approval_method in ('online', 'verbal', 'email', 'other')),
  status text not null default 'Draft'
    check (status in ('Draft', 'Sent', 'Accepted', 'Declined', 'Invoiced', 'Paid', 'Void')),
  approved_by_name text,
  approved_by_email text,
  public_token text unique,
  public_token_created_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_variations_job_idx on public.job_variations (job_id, created_at desc);
create index if not exists job_variations_status_idx on public.job_variations (business_id, status);

alter table public.job_variations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_variations'
      and policyname = 'Authenticated admin access job variations'
  ) then
    create policy "Authenticated admin access job variations"
      on public.job_variations for all
      using (auth.role() = 'authenticated');
  end if;
end $$;

alter table public.invoices
  add column if not exists variation_id uuid references public.job_variations(id) on delete set null;

create unique index if not exists invoices_variation_unique_idx on public.invoices (variation_id)
  where variation_id is not null;
