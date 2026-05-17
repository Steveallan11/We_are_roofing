create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  invoice_ref text not null,
  status text not null default 'Draft',
  issue_date date not null default current_date,
  due_date date not null default current_date,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  notes text,
  payment_terms text,
  pdf_url text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_method text,
  payment_reference text,
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

alter table job_documents
  add column if not exists invoice_id uuid references invoices(id) on delete set null;

create unique index if not exists invoices_business_invoice_ref_idx on invoices (business_id, invoice_ref);
create index if not exists invoices_job_idx on invoices (job_id, created_at desc);
create index if not exists invoices_status_idx on invoices (business_id, status);
create index if not exists invoice_payments_invoice_idx on invoice_payments (invoice_id, paid_at desc);
create index if not exists job_documents_invoice_idx on job_documents (invoice_id);
create unique index if not exists job_documents_job_invoice_type_idx
  on job_documents (job_id, invoice_id, document_type)
  where invoice_id is not null;

alter table invoices enable row level security;
alter table invoice_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoices' and policyname = 'Authenticated admin access'
  ) then
    create policy "Authenticated admin access" on public.invoices
      for all using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invoice_payments' and policyname = 'Authenticated admin access'
  ) then
    create policy "Authenticated admin access" on public.invoice_payments
      for all using (auth.role() = 'authenticated');
  end if;
end
$$;

drop trigger if exists invoices_updated_at on invoices;
create trigger invoices_updated_at
before update on invoices
for each row execute function update_updated_at_column();
