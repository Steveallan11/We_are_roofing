create table if not exists public.job_completion_details (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  works_summary text not null default '',
  included_variation_ids uuid[] not null default '{}',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_completion_details enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='job_completion_details' and policyname='Authenticated admin access job completion details') then
    create policy "Authenticated admin access job completion details"
      on public.job_completion_details for all using (auth.role() = 'authenticated');
  end if;
end $$;
