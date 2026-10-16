-- Allow one final invoice to include multiple approved additional-work items.
-- Allocations are kept separately so each variation's approved balance remains auditable.
create table if not exists public.invoice_variation_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  variation_id uuid not null references public.job_variations(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  vat_amount numeric(12,2) not null check (vat_amount >= 0),
  created_at timestamptz not null default now(),
  unique (invoice_id, variation_id)
);

create index if not exists invoice_variation_allocations_variation_idx
  on public.invoice_variation_allocations (variation_id, invoice_id);

alter table public.invoice_variation_allocations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='invoice_variation_allocations' and policyname='Authenticated admin access invoice variation allocations') then
    create policy "Authenticated admin access invoice variation allocations"
      on public.invoice_variation_allocations for all using (auth.role() = 'authenticated');
  end if;
end $$;

create or replace function public.prevent_variation_over_invoicing()
returns trigger language plpgsql as $$
declare
  approved_total numeric(12,2);
  already_invoiced numeric(12,2);
  invoice_job uuid;
  invoice_business uuid;
begin
  if new.variation_id is null or new.status = 'Void' then return new; end if;
  select total into approved_total from public.job_variations where id = new.variation_id for update;
  if approved_total is null then raise exception 'Linked additional work could not be found.'; end if;
  select coalesce(sum(total), 0) into already_invoiced from public.invoices
    where variation_id = new.variation_id and status <> 'Void' and id <> new.id;
  already_invoiced := already_invoiced + (select coalesce(sum(a.amount), 0)
    from public.invoice_variation_allocations a join public.invoices i on i.id=a.invoice_id
    where a.variation_id=new.variation_id and a.invoice_id<>new.id and i.status<>'Void');
  if already_invoiced + new.total > approved_total + 0.01 then
    raise exception 'Invoice total exceeds the approved additional-work balance.';
  end if;
  return new;
end $$;

create or replace function public.prevent_variation_allocation_over_invoicing()
returns trigger language plpgsql as $$
declare
  approved_total numeric(12,2);
  already_invoiced numeric(12,2);
  invoice_job uuid;
  invoice_business uuid;
  variation_job uuid;
  variation_business uuid;
begin
  if tg_op = 'DELETE' then return old; end if;
  select job_id, business_id into variation_job, variation_business
    from public.job_variations where id=new.variation_id for update;
  if variation_job is null then raise exception 'Linked additional work could not be found.'; end if;
  select job_id, business_id into invoice_job, invoice_business from public.invoices where id=new.invoice_id and status<>'Void';
  if invoice_job is null or invoice_job<>variation_job or invoice_business<>variation_business or new.business_id<>variation_business then
    raise exception 'Additional work and invoice must belong to the same active job and workspace.';
  end if;
  select total into approved_total from public.job_variations where id=new.variation_id;
  select coalesce(sum(i.total),0) into already_invoiced from public.invoices i
    where i.variation_id=new.variation_id and i.status<>'Void';
  already_invoiced := already_invoiced + (select coalesce(sum(a.amount),0)
    from public.invoice_variation_allocations a join public.invoices i on i.id=a.invoice_id
    where a.variation_id=new.variation_id and a.id<>new.id and i.status<>'Void');
  if already_invoiced + new.amount > approved_total + 0.01 then
    raise exception 'Invoice total exceeds the approved additional-work balance.';
  end if;
  return new;
end $$;

drop trigger if exists invoice_variation_allocations_guard on public.invoice_variation_allocations;
create trigger invoice_variation_allocations_guard
before insert or update on public.invoice_variation_allocations
for each row execute function public.prevent_variation_allocation_over_invoicing();
