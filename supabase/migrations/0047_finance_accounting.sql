-- Finance and accountant reporting extension.
-- Additive by design: existing invoice JSON lines and public schemas remain valid.

alter table public.invoices
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists invoice_date date,
  add column if not exists tax_point_date date,
  add column if not exists currency text not null default 'GBP';

update public.invoices
set invoice_date = coalesce(invoice_date, issue_date),
    tax_point_date = coalesce(tax_point_date, issue_date)
where invoice_date is null or tax_point_date is null;

update public.invoices i
set customer_id = j.customer_id
from public.jobs j
where i.job_id = j.id and i.business_id = j.business_id and i.customer_id is null;

alter table public.invoices
  alter column invoice_date set default current_date,
  alter column invoice_date set not null,
  alter column tax_point_date set default current_date,
  alter column tax_point_date set not null;

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(14,4) not null default 1,
  unit text,
  unit_price numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  vat_rate numeric(6,3),
  vat_code text not null default '20' check (vat_code in ('0','5','20','exempt','outside_scope')),
  vat_amount numeric(14,2) not null default 0,
  gross_amount numeric(14,2) not null default 0,
  category text,
  job_cost_code text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.invoice_payments
  add column if not exists business_id uuid references public.businesses(id) on delete cascade,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists payment_date date,
  add column if not exists reference text;

update public.invoice_payments p
set business_id = i.business_id,
    customer_id = coalesce(i.customer_id, j.customer_id),
    job_id = i.job_id,
    payment_date = coalesce(p.payment_date, p.paid_at::date),
    reference = coalesce(p.reference, p.payment_reference)
from public.invoices i
left join public.jobs j on j.id = i.job_id
where p.invoice_id = i.id
  and (p.business_id is null or p.job_id is null or p.payment_date is null);

create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  credit_note_number text not null,
  credit_note_date date not null,
  tax_point_date date not null,
  currency text not null default 'GBP',
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  reason text,
  status text not null default 'Issued' check (status in ('Draft','Issued','Applied','Cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, credit_note_number)
);

create table if not exists public.credit_note_lines (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.credit_notes(id) on delete cascade,
  description text not null,
  quantity numeric(14,4) not null default 1,
  unit text,
  unit_price numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  vat_rate numeric(6,3),
  vat_code text not null default '20' check (vat_code in ('0','5','20','exempt','outside_scope')),
  vat_amount numeric(14,2) not null default 0,
  gross_amount numeric(14,2) not null default 0,
  category text,
  job_cost_code text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.suppliers
  add column if not exists address text,
  add column if not exists vat_number text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.supplier_bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  bill_number text not null,
  supplier_reference text,
  bill_date date not null,
  tax_point_date date not null,
  due_date date,
  status text not null default 'Received' check (status in ('Draft','Received','Part Paid','Paid','Overdue','Cancelled','Credited')),
  currency text not null default 'GBP',
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  amount_outstanding numeric(14,2) not null default 0,
  expense_category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, bill_number)
);

create table if not exists public.supplier_bill_lines (
  id uuid primary key default gen_random_uuid(),
  supplier_bill_id uuid not null references public.supplier_bills(id) on delete cascade,
  description text not null,
  quantity numeric(14,4) not null default 1,
  unit text,
  unit_cost numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  vat_rate numeric(6,3),
  vat_code text not null default '20' check (vat_code in ('0','5','20','exempt','outside_scope')),
  vat_amount numeric(14,2) not null default 0,
  gross_amount numeric(14,2) not null default 0,
  expense_category text,
  job_cost_code text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  supplier_bill_id uuid not null references public.supplier_bills(id) on delete cascade,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

-- job_expenses is the existing miscellaneous expense ledger. Relax its old
-- category check so categories can grow without another database migration.
do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.job_expenses'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%category%';
  if constraint_name is not null then
    execute format('alter table public.job_expenses drop constraint %I', constraint_name);
  end if;
end $$;

create table if not exists public.finance_audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  visible_reference text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.generate_credit_note_number() returns trigger
language plpgsql set search_path = public as $$
declare next_num integer;
begin
  select coalesce(max((regexp_match(credit_note_number, '(\d+)$'))[1]::integer), 1000) + 1
  into next_num from public.credit_notes where business_id = new.business_id;
  new.credit_note_number := 'WR-CN-' || lpad(next_num::text, 4, '0');
  return new;
end; $$;
drop trigger if exists set_credit_note_number on public.credit_notes;
create trigger set_credit_note_number before insert on public.credit_notes
for each row when (new.credit_note_number is null) execute function public.generate_credit_note_number();

create or replace function public.generate_supplier_bill_number() returns trigger
language plpgsql set search_path = public as $$
declare next_num integer;
begin
  select coalesce(max((regexp_match(bill_number, '(\d+)$'))[1]::integer), 1000) + 1
  into next_num from public.supplier_bills where business_id = new.business_id;
  new.bill_number := 'WR-BILL-' || lpad(next_num::text, 4, '0');
  return new;
end; $$;
drop trigger if exists set_supplier_bill_number on public.supplier_bills;
create trigger set_supplier_bill_number before insert on public.supplier_bills
for each row when (new.bill_number is null) execute function public.generate_supplier_bill_number();

-- Payment writes are atomic and lock the parent document so two concurrent
-- MCP calls cannot over-allocate the same balance.
create or replace function public.record_customer_payment_finance(
  p_business_id uuid,
  p_invoice_ref text,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference text default null,
  p_notes text default null,
  p_actor_id text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare inv public.invoices%rowtype;
declare payment_id uuid;
declare new_paid numeric(14,2);
declare new_balance numeric(14,2);
begin
  if p_amount <= 0 then raise exception 'Payment amount must be greater than zero.'; end if;
  select * into inv from public.invoices
  where business_id = p_business_id and invoice_ref = p_invoice_ref for update;
  if not found then raise exception 'Invoice not found in this workspace.'; end if;
  if inv.status in ('Void','Cancelled','Draft') then raise exception 'Payment cannot be recorded against this invoice status.'; end if;
  if round(p_amount, 2) > round(coalesce(inv.balance_due, inv.total - inv.amount_paid), 2) then
    raise exception 'Payment exceeds the invoice outstanding amount.';
  end if;
  new_paid := round(coalesce(inv.amount_paid, 0) + p_amount, 2);
  new_balance := greatest(0, round(coalesce(inv.balance_due, inv.total - inv.amount_paid) - p_amount, 2));
  insert into public.invoice_payments (business_id, customer_id, job_id, invoice_id, payment_date, paid_at, amount, payment_method, payment_reference, reference, notes)
  values (p_business_id, inv.customer_id, inv.job_id, inv.id, p_payment_date, p_payment_date::timestamptz, round(p_amount,2), p_payment_method, p_reference, p_reference, p_notes)
  returning id into payment_id;
  update public.invoices set amount_paid = new_paid, balance_due = new_balance,
    status = case when new_balance = 0 then 'Paid' else 'Part Paid' end,
    paid_at = case when new_balance = 0 then p_payment_date::timestamptz else paid_at end,
    updated_at = now()
  where id = inv.id;
  insert into public.finance_audit_log (business_id, actor_id, action, entity_type, entity_id, visible_reference, details)
  values (p_business_id, p_actor_id, 'record_customer_payment', 'invoice_payment', payment_id, p_invoice_ref,
    jsonb_build_object('amount', round(p_amount,2), 'payment_date', p_payment_date, 'new_balance', new_balance));
  return jsonb_build_object('payment_id', payment_id, 'invoice_number', p_invoice_ref, 'amount_paid', round(p_amount,2), 'amount_outstanding', new_balance);
end;
$$;

create or replace function public.record_supplier_payment_finance(
  p_business_id uuid,
  p_bill_number text,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference text default null,
  p_notes text default null,
  p_actor_id text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare bill public.supplier_bills%rowtype;
declare payment_id uuid;
declare new_paid numeric(14,2);
declare new_balance numeric(14,2);
begin
  if p_amount <= 0 then raise exception 'Payment amount must be greater than zero.'; end if;
  select * into bill from public.supplier_bills
  where business_id = p_business_id and bill_number = p_bill_number for update;
  if not found then raise exception 'Supplier bill not found in this workspace.'; end if;
  if bill.status in ('Cancelled','Credited','Draft') then raise exception 'Payment cannot be recorded against this bill status.'; end if;
  if round(p_amount, 2) > round(bill.amount_outstanding, 2) then raise exception 'Payment exceeds the supplier bill outstanding amount.'; end if;
  new_paid := round(coalesce(bill.amount_paid, 0) + p_amount, 2);
  new_balance := greatest(0, round(bill.amount_outstanding - p_amount, 2));
  insert into public.supplier_payments (business_id, supplier_id, job_id, supplier_bill_id, payment_date, amount, payment_method, reference, notes)
  values (p_business_id, bill.supplier_id, bill.job_id, bill.id, p_payment_date, round(p_amount,2), p_payment_method, p_reference, p_notes)
  returning id into payment_id;
  update public.supplier_bills set amount_paid = new_paid, amount_outstanding = new_balance,
    status = case when new_balance = 0 then 'Paid' else 'Part Paid' end, updated_at = now()
  where id = bill.id;
  insert into public.finance_audit_log (business_id, actor_id, action, entity_type, entity_id, visible_reference, details)
  values (p_business_id, p_actor_id, 'record_supplier_payment', 'supplier_payment', payment_id, p_bill_number,
    jsonb_build_object('amount', round(p_amount,2), 'payment_date', p_payment_date, 'new_balance', new_balance));
  return jsonb_build_object('payment_id', payment_id, 'bill_number', p_bill_number, 'amount_paid', round(p_amount,2), 'amount_outstanding', new_balance);
end;
$$;

alter table public.job_expenses
  alter column job_id drop not null,
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists net_amount numeric(14,2),
  add column if not exists gross_amount numeric(14,2),
  add column if not exists vat_rate numeric(6,3),
  add column if not exists vat_code text default '20',
  add column if not exists payment_method text,
  add column if not exists reference text;

update public.job_expenses
set net_amount = coalesce(net_amount, amount),
    gross_amount = coalesce(gross_amount, amount + vat_amount)
where net_amount is null or gross_amount is null;

create index if not exists invoices_business_invoice_date_idx on public.invoices (business_id, invoice_date desc);
create index if not exists invoices_business_tax_point_idx on public.invoices (business_id, tax_point_date desc);
create index if not exists invoices_business_due_status_idx on public.invoices (business_id, due_date, status);
create index if not exists invoices_business_job_idx on public.invoices (business_id, job_id);
create index if not exists invoices_business_customer_idx on public.invoices (business_id, customer_id);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id, sort_order);
create index if not exists invoice_payments_business_date_idx on public.invoice_payments (business_id, payment_date desc);
create index if not exists credit_notes_business_date_idx on public.credit_notes (business_id, tax_point_date desc);
create index if not exists credit_notes_business_job_idx on public.credit_notes (business_id, job_id);
create index if not exists supplier_bills_business_date_idx on public.supplier_bills (business_id, bill_date desc);
create index if not exists supplier_bills_business_due_status_idx on public.supplier_bills (business_id, due_date, status);
create index if not exists supplier_bills_business_job_idx on public.supplier_bills (business_id, job_id);
create index if not exists supplier_bills_business_supplier_idx on public.supplier_bills (business_id, supplier_id);
create index if not exists supplier_bill_lines_bill_idx on public.supplier_bill_lines (supplier_bill_id, sort_order);
create index if not exists supplier_payments_business_date_idx on public.supplier_payments (business_id, payment_date desc);
create index if not exists job_expenses_business_date_idx on public.job_expenses (business_id, expense_date desc);
create index if not exists job_expenses_business_supplier_idx on public.job_expenses (business_id, supplier_id);
create index if not exists finance_audit_business_date_idx on public.finance_audit_log (business_id, created_at desc);

alter table public.invoice_lines enable row level security;
alter table public.credit_notes enable row level security;
alter table public.credit_note_lines enable row level security;
alter table public.supplier_bills enable row level security;
alter table public.supplier_bill_lines enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.finance_audit_log enable row level security;

-- The current OS has one authenticated admin. Service-role MCP access still
-- applies explicit business_id predicates in application code; these policies
-- preserve the existing authenticated-admin browser access model.
do $$
declare table_name text;
begin
  foreach table_name in array array['invoice_lines','credit_notes','credit_note_lines','supplier_bills','supplier_bill_lines','supplier_payments','finance_audit_log']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = table_name and policyname = 'Authenticated admin access'
    ) then
      execute format('create policy "Authenticated admin access" on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', table_name);
    end if;
  end loop;
end $$;
