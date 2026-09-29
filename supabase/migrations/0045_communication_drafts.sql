create table if not exists public.communication_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  channel text not null default 'email' check (channel in ('email', 'sms', 'whatsapp')),
  subject text,
  body text not null,
  literature_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed', 'discarded')),
  created_by text not null default 'admin',
  sent_message_id uuid references public.messages(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communication_drafts_conversation_idx
  on public.communication_drafts (conversation_id, status, updated_at desc);

create index if not exists communication_drafts_job_idx
  on public.communication_drafts (job_id, status, updated_at desc);

alter table public.communication_drafts enable row level security;

alter table public.communication_drafts drop constraint if exists communication_drafts_status_check;
alter table public.communication_drafts add constraint communication_drafts_status_check
  check (status in ('draft', 'sending', 'sent', 'failed', 'discarded'));

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'communication_drafts'
      and policyname = 'Authenticated admin access communication drafts'
  ) then
    create policy "Authenticated admin access communication drafts"
      on public.communication_drafts for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

drop trigger if exists communication_drafts_updated_at on public.communication_drafts;
create trigger communication_drafts_updated_at
before update on public.communication_drafts
for each row execute function update_updated_at_column();

notify pgrst, 'reload schema';
