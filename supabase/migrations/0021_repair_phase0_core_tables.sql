-- Idempotent repair for Phase 0 core admin tables.
-- Safe to run after partial/manual SQL attempts: policies and indexes are checked before creation.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  invoice_ref text,
  status text not null default 'Draft',
  issue_date date not null default current_date,
  due_date date not null default current_date,
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  description text,
  notes text,
  payment_terms text,
  pdf_url text,
  sent_at timestamptz,
  sent_to_email text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.invoices add column if not exists job_id uuid references public.jobs(id) on delete cascade;
alter table public.invoices add column if not exists quote_id uuid references public.quotes(id) on delete set null;
alter table public.invoices add column if not exists invoice_ref text;
alter table public.invoices add column if not exists status text not null default 'Draft';
alter table public.invoices add column if not exists issue_date date not null default current_date;
alter table public.invoices add column if not exists due_date date not null default current_date;
alter table public.invoices add column if not exists line_items jsonb not null default '[]'::jsonb;
alter table public.invoices add column if not exists subtotal numeric(12,2) not null default 0;
alter table public.invoices add column if not exists vat_amount numeric(12,2) not null default 0;
alter table public.invoices add column if not exists total numeric(12,2) not null default 0;
alter table public.invoices add column if not exists amount_paid numeric(12,2) not null default 0;
alter table public.invoices add column if not exists balance_due numeric(12,2) not null default 0;
alter table public.invoices add column if not exists description text;
alter table public.invoices add column if not exists notes text;
alter table public.invoices add column if not exists payment_terms text;
alter table public.invoices add column if not exists pdf_url text;
alter table public.invoices add column if not exists sent_at timestamptz;
alter table public.invoices add column if not exists sent_to_email text;
alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists created_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_at timestamptz not null default now();

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_method text,
  payment_reference text,
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.job_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  document_type text not null,
  display_name text not null,
  storage_bucket text,
  storage_path text,
  public_url text,
  source_type text not null default 'generated',
  mime_type text,
  file_size integer,
  content_html text,
  created_at timestamptz not null default now()
);

alter table public.job_documents add column if not exists quote_id uuid references public.quotes(id) on delete set null;
alter table public.job_documents add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
alter table public.job_documents add column if not exists storage_bucket text;
alter table public.job_documents add column if not exists storage_path text;
alter table public.job_documents add column if not exists public_url text;
alter table public.job_documents add column if not exists source_type text not null default 'generated';
alter table public.job_documents add column if not exists mime_type text;
alter table public.job_documents add column if not exists file_size integer;
alter table public.job_documents add column if not exists content_html text;

create table if not exists public.quote_attachments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  job_photo_id uuid references public.job_photos(id) on delete set null,
  job_document_id uuid references public.job_documents(id) on delete set null,
  attachment_type text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists invoices_business_invoice_ref_idx on public.invoices (business_id, invoice_ref);
create index if not exists invoices_job_idx on public.invoices (job_id, created_at desc);
create index if not exists invoices_status_idx on public.invoices (business_id, status);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id, paid_at desc);
create index if not exists job_documents_job_quote_idx on public.job_documents (job_id, quote_id);
create index if not exists job_documents_invoice_idx on public.job_documents (invoice_id);
create unique index if not exists job_documents_job_invoice_type_idx
  on public.job_documents (job_id, invoice_id, document_type)
  where invoice_id is not null;
create index if not exists quote_attachments_quote_idx on public.quote_attachments (quote_id);
create index if not exists quote_attachments_job_document_idx on public.quote_attachments (job_document_id);

alter table public.invoices enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.job_documents enable row level security;
alter table public.quote_attachments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = 'Authenticated admin access') then
    create policy "Authenticated admin access" on public.invoices
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoice_payments' and policyname = 'Authenticated admin access') then
    create policy "Authenticated admin access" on public.invoice_payments
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_documents' and policyname = 'Authenticated admin access') then
    create policy "Authenticated admin access" on public.job_documents
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'quote_attachments' and policyname = 'Authenticated admin access') then
    create policy "Authenticated admin access" on public.quote_attachments
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end
$$;

create or replace function public.generate_invoice_ref()
returns trigger as $$
declare next_num int;
begin
  select coalesce(max(cast(regexp_replace(invoice_ref, '[^0-9]', '', 'g') as int)), 0) + 1
  into next_num
  from public.invoices
  where business_id = new.business_id;

  new.invoice_ref := 'WR-INV-' || lpad(next_num::text, 4, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_invoice_ref on public.invoices;
create trigger set_invoice_ref
  before insert on public.invoices
  for each row
  when (new.invoice_ref is null)
  execute function public.generate_invoice_ref();

notify pgrst, 'reload schema';
