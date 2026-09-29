-- Staged bank-statement imports and controlled reconciliation.
-- Imported rows are not accounting records until an explicitly confirmed commit.

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_ref text not null,
  source_name text not null,
  original_filename text,
  account_name text,
  account_last_four text,
  period_start date,
  period_end date,
  status text not null default 'Review'
    check (status in ('Review','Ready','Committed','Cancelled')),
  row_count integer not null default 0,
  debit_total numeric(14,2) not null default 0,
  credit_total numeric(14,2) not null default 0,
  notes text,
  created_by text,
  committed_by text,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, import_ref)
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_id uuid not null references public.bank_statement_imports(id) on delete cascade,
  transaction_ref text not null,
  row_index integer not null,
  transaction_date date not null,
  description text not null,
  reference text,
  amount numeric(14,2) not null check (amount <> 0),
  direction text not null check (direction in ('money_in','money_out')),
  balance numeric(14,2),
  currency text not null default 'GBP',
  fingerprint text not null,
  proposed_type text not null default 'unmatched'
    check (proposed_type in ('expense','customer_payment','supplier_payment','transfer','refund','income','ignore','unmatched')),
  category text,
  vat_code text not null default 'outside_scope'
    check (vat_code in ('0','5','20','exempt','outside_scope')),
  net_amount numeric(14,2),
  vat_amount numeric(14,2) not null default 0,
  gross_amount numeric(14,2),
  supplier_id uuid references public.suppliers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  supplier_bill_id uuid references public.supplier_bills(id) on delete set null,
  proposed_supplier_name text,
  proposed_job_ref text,
  proposed_invoice_number text,
  proposed_bill_number text,
  confidence numeric(5,2) not null default 0 check (confidence between 0 and 100),
  reasoning text,
  review_status text not null default 'Needs Review'
    check (review_status in ('Needs Review','Approved','Rejected','Duplicate','Committed')),
  duplicate_of uuid references public.bank_transactions(id) on delete set null,
  committed_entity_type text,
  committed_entity_id uuid,
  reviewed_by text,
  reviewed_at timestamptz,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, transaction_ref),
  unique (import_id, row_index)
);

alter table public.job_expenses
  add column if not exists bank_transaction_id uuid references public.bank_transactions(id) on delete set null;
alter table public.invoice_payments
  add column if not exists bank_transaction_id uuid references public.bank_transactions(id) on delete set null;
alter table public.supplier_payments
  add column if not exists bank_transaction_id uuid references public.bank_transactions(id) on delete set null;

create unique index if not exists job_expenses_bank_transaction_idx
  on public.job_expenses (bank_transaction_id) where bank_transaction_id is not null;
create unique index if not exists invoice_payments_bank_transaction_idx
  on public.invoice_payments (bank_transaction_id) where bank_transaction_id is not null;
create unique index if not exists supplier_payments_bank_transaction_idx
  on public.supplier_payments (bank_transaction_id) where bank_transaction_id is not null;
create index if not exists bank_imports_business_created_idx
  on public.bank_statement_imports (business_id, created_at desc);
create index if not exists bank_transactions_business_date_idx
  on public.bank_transactions (business_id, transaction_date desc);
create index if not exists bank_transactions_import_review_idx
  on public.bank_transactions (import_id, review_status, row_index);
create index if not exists bank_transactions_business_fingerprint_idx
  on public.bank_transactions (business_id, fingerprint);

alter table public.bank_statement_imports enable row level security;
alter table public.bank_transactions enable row level security;

do $$
declare target_table text;
begin
  foreach target_table in array array['bank_statement_imports','bank_transactions']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=target_table and policyname='Authenticated admin access'
    ) then
      execute format('create policy "Authenticated admin access" on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', target_table);
    end if;
  end loop;
end $$;

drop trigger if exists bank_statement_imports_updated_at on public.bank_statement_imports;
create trigger bank_statement_imports_updated_at before update on public.bank_statement_imports
for each row execute function update_updated_at_column();
drop trigger if exists bank_transactions_updated_at on public.bank_transactions;
create trigger bank_transactions_updated_at before update on public.bank_transactions
for each row execute function update_updated_at_column();

create or replace function public.enforce_bank_transaction_scope()
returns trigger language plpgsql as $$
declare linked_business uuid;
begin
  select business_id into linked_business from public.bank_statement_imports where id=new.import_id;
  if linked_business is null or linked_business <> new.business_id then raise exception 'Statement import does not belong to this business.'; end if;
  if new.job_id is not null and not exists (select 1 from public.jobs where id=new.job_id and business_id=new.business_id) then raise exception 'Job does not belong to this business.'; end if;
  if new.supplier_id is not null and not exists (select 1 from public.suppliers where id=new.supplier_id and business_id=new.business_id) then raise exception 'Supplier does not belong to this business.'; end if;
  if new.invoice_id is not null and not exists (select 1 from public.invoices where id=new.invoice_id and business_id=new.business_id) then raise exception 'Invoice does not belong to this business.'; end if;
  if new.supplier_bill_id is not null and not exists (select 1 from public.supplier_bills where id=new.supplier_bill_id and business_id=new.business_id) then raise exception 'Supplier bill does not belong to this business.'; end if;
  return new;
end $$;

drop trigger if exists bank_transaction_scope on public.bank_transactions;
create trigger bank_transaction_scope before insert or update of business_id, import_id, job_id, supplier_id, invoice_id, supplier_bill_id
on public.bank_transactions for each row execute function public.enforce_bank_transaction_scope();

create or replace function public.commit_bank_statement_import(
  p_business_id uuid,
  p_import_ref text,
  p_actor_id text default null
) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare
  statement_import public.bank_statement_imports%rowtype;
  tx public.bank_transactions%rowtype;
  inv public.invoices%rowtype;
  bill public.supplier_bills%rowtype;
  result jsonb;
  entity_id uuid;
  committed_count integer := 0;
  ignored_count integer := 0;
begin
  select * into statement_import from public.bank_statement_imports
  where business_id=p_business_id and import_ref=p_import_ref for update;
  if not found then raise exception 'Statement import not found in this workspace.'; end if;
  if statement_import.status='Committed' then raise exception 'This statement import has already been committed.'; end if;
  if exists (select 1 from public.bank_transactions where import_id=statement_import.id and review_status='Needs Review') then
    raise exception 'Every transaction must be approved, rejected or marked duplicate before commit.';
  end if;

  for tx in select * from public.bank_transactions where import_id=statement_import.id and review_status='Approved' order by row_index for update
  loop
    if exists (
      select 1 from public.bank_transactions other
      where other.business_id=p_business_id and other.fingerprint=tx.fingerprint
        and other.id<>tx.id and other.review_status='Committed'
    ) then raise exception 'Transaction % matches a previously committed transaction.', tx.transaction_ref; end if;

    entity_id := null;
    if tx.proposed_type='expense' then
      if tx.direction<>'money_out' then raise exception 'Expense % must be money out.', tx.transaction_ref; end if;
      if tx.category is null or tx.net_amount is null or tx.gross_amount is null then raise exception 'Expense % needs category, net and gross amounts.', tx.transaction_ref; end if;
      if round(tx.net_amount + tx.vat_amount,2) <> round(tx.gross_amount,2) or round(tx.gross_amount,2) <> abs(round(tx.amount,2)) then
        raise exception 'Expense % amounts do not reconcile to the bank value.', tx.transaction_ref;
      end if;
      insert into public.job_expenses (business_id,job_id,supplier_id,supplier_name,expense_date,description,category,amount,net_amount,vat_rate,vat_code,vat_amount,gross_amount,payment_method,reference,notes,bank_transaction_id)
      values (p_business_id,tx.job_id,tx.supplier_id,tx.proposed_supplier_name,tx.transaction_date,tx.description,tx.category,tx.net_amount,tx.net_amount,
        case tx.vat_code when '5' then 5 when '20' then 20 else 0 end,tx.vat_code,tx.vat_amount,tx.gross_amount,'Bank Transfer',coalesce(tx.reference,tx.transaction_ref),'Imported from bank statement '||p_import_ref,tx.id)
      returning id into entity_id;
      tx.committed_entity_type := 'expense';
    elsif tx.proposed_type='customer_payment' then
      if tx.direction<>'money_in' or tx.invoice_id is null then raise exception 'Customer receipt % needs a matched invoice.', tx.transaction_ref; end if;
      select * into inv from public.invoices where id=tx.invoice_id and business_id=p_business_id for update;
      if not found then raise exception 'Matched invoice for % was not found.', tx.transaction_ref; end if;
      select public.record_customer_payment_finance(p_business_id,inv.invoice_ref,abs(tx.amount),tx.transaction_date,'Bank Transfer',coalesce(tx.reference,tx.transaction_ref),'Matched from bank statement '||p_import_ref,p_actor_id) into result;
      entity_id := (result->>'payment_id')::uuid;
      update public.invoice_payments set bank_transaction_id=tx.id where id=entity_id;
      tx.committed_entity_type := 'customer_payment';
    elsif tx.proposed_type='supplier_payment' then
      if tx.direction<>'money_out' or tx.supplier_bill_id is null then raise exception 'Supplier payment % needs a matched supplier bill.', tx.transaction_ref; end if;
      select * into bill from public.supplier_bills where id=tx.supplier_bill_id and business_id=p_business_id for update;
      if not found then raise exception 'Matched supplier bill for % was not found.', tx.transaction_ref; end if;
      select public.record_supplier_payment_finance(p_business_id,bill.bill_number,abs(tx.amount),tx.transaction_date,'Bank Transfer',coalesce(tx.reference,tx.transaction_ref),'Matched from bank statement '||p_import_ref,p_actor_id) into result;
      entity_id := (result->>'payment_id')::uuid;
      update public.supplier_payments set bank_transaction_id=tx.id where id=entity_id;
      tx.committed_entity_type := 'supplier_payment';
    elsif tx.proposed_type in ('transfer','ignore') then
      tx.committed_entity_type := tx.proposed_type;
      ignored_count := ignored_count + 1;
    else
      raise exception 'Transaction % has unsupported commit type %.', tx.transaction_ref, tx.proposed_type;
    end if;

    update public.bank_transactions set review_status='Committed', committed_entity_type=tx.committed_entity_type,
      committed_entity_id=entity_id, committed_at=now(), updated_at=now() where id=tx.id;
    committed_count := committed_count + 1;
    insert into public.finance_audit_log (business_id,actor_id,action,entity_type,entity_id,visible_reference,details)
    values (p_business_id,p_actor_id,'commit_bank_transaction','bank_transaction',tx.id,tx.transaction_ref,
      jsonb_build_object('import_ref',p_import_ref,'type',tx.proposed_type,'amount',tx.amount,'committed_entity_type',tx.committed_entity_type,'committed_entity_id',entity_id));
  end loop;

  update public.bank_statement_imports set status='Committed',committed_by=p_actor_id,committed_at=now(),updated_at=now()
  where id=statement_import.id;
  insert into public.finance_audit_log (business_id,actor_id,action,entity_type,entity_id,visible_reference,details)
  values (p_business_id,p_actor_id,'commit_bank_statement_import','bank_statement_import',statement_import.id,p_import_ref,
    jsonb_build_object('committed_rows',committed_count,'non_ledger_rows',ignored_count));
  return jsonb_build_object('import_ref',p_import_ref,'committed_rows',committed_count,'non_ledger_rows',ignored_count,'status','Committed');
end $$;
