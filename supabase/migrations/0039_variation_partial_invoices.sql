-- Allow approved additional work to be invoiced in stages while preventing over-invoicing.

drop index if exists public.invoices_variation_unique_idx;

create index if not exists invoices_variation_idx
  on public.invoices (variation_id, created_at)
  where variation_id is not null;

create or replace function public.prevent_variation_over_invoicing()
returns trigger
language plpgsql
as $$
declare
  approved_total numeric(12,2);
  already_invoiced numeric(12,2);
begin
  if new.variation_id is null or new.status = 'Void' then
    return new;
  end if;

  select total
    into approved_total
    from public.job_variations
    where id = new.variation_id
    for update;

  if approved_total is null then
    raise exception 'Linked additional work could not be found.';
  end if;

  select coalesce(sum(total), 0)
    into already_invoiced
    from public.invoices
    where variation_id = new.variation_id
      and status <> 'Void'
      and id <> new.id;

  if already_invoiced + new.total > approved_total + 0.01 then
    raise exception 'Invoice total exceeds the approved additional-work balance.';
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_prevent_variation_over_invoicing on public.invoices;

create trigger invoices_prevent_variation_over_invoicing
before insert or update of variation_id, total, status
on public.invoices
for each row
execute function public.prevent_variation_over_invoicing();
