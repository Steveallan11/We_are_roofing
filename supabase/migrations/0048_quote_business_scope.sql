-- Give quotes a direct workspace key for secure MCP and reporting filters.
-- Existing application inserts remain compatible because the trigger derives
-- the workspace from the selected job.

alter table public.quotes
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;

update public.quotes q
set business_id = j.business_id
from public.jobs j
where q.job_id = j.id and q.business_id is null;

do $$
begin
  if exists (select 1 from public.quotes where business_id is null) then
    raise exception 'Cannot scope every quote to a business because one or more quote jobs are invalid.';
  end if;
end $$;

alter table public.quotes alter column business_id set not null;

create index if not exists quotes_business_updated_idx
  on public.quotes (business_id, updated_at desc);

create index if not exists quotes_business_ref_idx
  on public.quotes (business_id, quote_ref);

create or replace function public.set_quote_business_from_job() returns trigger
language plpgsql
set search_path = public
as $$
declare scoped_business_id uuid;
begin
  select business_id into scoped_business_id from public.jobs where id = new.job_id;
  if scoped_business_id is null then
    raise exception 'Quote job does not belong to an available business.';
  end if;
  if new.business_id is not null and new.business_id <> scoped_business_id then
    raise exception 'Quote and job must belong to the same business.';
  end if;
  new.business_id := scoped_business_id;
  return new;
end;
$$;

drop trigger if exists scope_quote_to_job_business on public.quotes;
create trigger scope_quote_to_job_business
before insert or update of job_id, business_id on public.quotes
for each row execute function public.set_quote_business_from_job();
