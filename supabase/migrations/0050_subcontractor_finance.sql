-- Subcontractor finance ledger and payment details.
-- Extends the existing labour_people and finance model without replacing it.

alter table public.labour_people
  add column if not exists utr_number text,
  add column if not exists cis_status text not null default 'not_registered'
    check (cis_status in ('gross','net_20','net_30','not_registered')),
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_number text,
  add column if not exists payment_terms_days integer not null default 7 check (payment_terms_days between 0 and 365),
  add column if not exists bank_account_name text,
  add column if not exists bank_sort_code text,
  add column if not exists bank_account_number text,
  add column if not exists public_liability_expiry date,
  add column if not exists employers_liability_expiry date,
  add column if not exists verification_notes text;

create table if not exists public.subcontractor_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subcontractor_id uuid not null references public.labour_people(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  cost_reference text,
  work_date date not null,
  period_end_date date,
  invoice_reference text,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit text not null default 'day' check (unit in ('hour','day','item','fixed')),
  unit_rate numeric(14,2) not null default 0 check (unit_rate >= 0),
  net_amount numeric(14,2) not null default 0 check (net_amount >= 0),
  vat_rate numeric(6,3) not null default 0 check (vat_rate in (0,5,20)),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  gross_amount numeric(14,2) not null default 0 check (gross_amount >= 0),
  cis_rate numeric(6,3) not null default 0 check (cis_rate in (0,20,30)),
  cis_deduction numeric(14,2) not null default 0 check (cis_deduction >= 0),
  amount_payable numeric(14,2) not null default 0 check (amount_payable >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  amount_outstanding numeric(14,2) not null default 0 check (amount_outstanding >= 0),
  due_date date,
  status text not null default 'Draft'
    check (status in ('Draft','Approved','Part Paid','Paid','Cancelled')),
  payment_date date,
  payment_method text,
  payment_reference text,
  notes text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subcontractor_payments
  add column if not exists cost_reference text;

create index if not exists subcontractor_payments_business_date_idx
  on public.subcontractor_payments (business_id, work_date desc);
create unique index if not exists subcontractor_payments_business_ref_idx
  on public.subcontractor_payments (business_id, cost_reference)
  where cost_reference is not null;
create index if not exists subcontractor_payments_job_date_idx
  on public.subcontractor_payments (business_id, job_id, work_date desc);
create index if not exists subcontractor_payments_person_date_idx
  on public.subcontractor_payments (business_id, subcontractor_id, work_date desc);
create index if not exists subcontractor_payments_outstanding_idx
  on public.subcontractor_payments (business_id, status, due_date)
  where amount_outstanding > 0;

alter table public.subcontractor_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subcontractor_payments' and policyname = 'Authenticated admin access'
  ) then
    create policy "Authenticated admin access" on public.subcontractor_payments
      for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

create or replace function public.enforce_subcontractor_payment_scope()
returns trigger language plpgsql as $$
declare worker_business uuid;
declare worker_type_value text;
declare job_business uuid;
begin
  select business_id, worker_type into worker_business, worker_type_value
  from public.labour_people where id = new.subcontractor_id;
  select business_id into job_business from public.jobs where id = new.job_id;
  if worker_business is null or worker_business <> new.business_id or worker_type_value <> 'subcontractor' then
    raise exception 'Subcontractor does not belong to this business';
  end if;
  if job_business is null or job_business <> new.business_id then
    raise exception 'Job does not belong to this business';
  end if;
  return new;
end $$;

drop trigger if exists subcontractor_payment_scope on public.subcontractor_payments;
create trigger subcontractor_payment_scope
before insert or update of business_id, subcontractor_id, job_id on public.subcontractor_payments
for each row execute function public.enforce_subcontractor_payment_scope();

drop trigger if exists subcontractor_payments_updated_at on public.subcontractor_payments;
create trigger subcontractor_payments_updated_at
before update on public.subcontractor_payments
for each row execute function update_updated_at_column();

create or replace function public.record_subcontractor_payment(
  p_business_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference text default null,
  p_actor_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare item public.subcontractor_payments%rowtype;
declare new_paid numeric(14,2);
declare new_outstanding numeric(14,2);
begin
  if p_amount <= 0 then raise exception 'Payment amount must be greater than zero.'; end if;
  select * into item from public.subcontractor_payments
    where id = p_payment_id and business_id = p_business_id for update;
  if not found then raise exception 'Subcontractor cost not found in this workspace.'; end if;
  if item.status in ('Draft','Cancelled') then raise exception 'Approve this subcontractor cost before recording payment.'; end if;
  if round(p_amount,2) > round(item.amount_outstanding,2) then raise exception 'Payment exceeds the outstanding amount.'; end if;
  new_paid := round(item.amount_paid + p_amount, 2);
  new_outstanding := greatest(0, round(item.amount_outstanding - p_amount, 2));
  update public.subcontractor_payments set
    amount_paid = new_paid,
    amount_outstanding = new_outstanding,
    status = case when new_outstanding = 0 then 'Paid' else 'Part Paid' end,
    payment_date = p_payment_date,
    payment_method = p_payment_method,
    payment_reference = p_reference,
    updated_at = now()
  where id = item.id;
  insert into public.finance_audit_log (business_id, actor_id, action, entity_type, entity_id, visible_reference, details)
  values (p_business_id, p_actor_id::text, 'record_subcontractor_payment', 'subcontractor_payment', item.id, item.invoice_reference,
    jsonb_build_object('amount', round(p_amount,2), 'payment_date', p_payment_date, 'amount_outstanding', new_outstanding));
  return jsonb_build_object('id', item.id, 'amount_paid', new_paid, 'amount_outstanding', new_outstanding,
    'status', case when new_outstanding = 0 then 'Paid' else 'Part Paid' end);
end $$;
