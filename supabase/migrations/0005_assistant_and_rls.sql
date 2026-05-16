create table if not exists assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant_action_log (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references assistant_conversations(id) on delete cascade,
  tool_name text not null,
  tool_input jsonb,
  tool_result jsonb,
  success boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists assistant_conversations_business_idx on assistant_conversations (business_id, updated_at desc);
create index if not exists assistant_action_log_conversation_idx on assistant_action_log (conversation_id, created_at desc);

alter table assistant_conversations enable row level security;
alter table assistant_action_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assistant_conversations' and policyname = 'Authenticated admin access assistant conversations'
  ) then
    create policy "Authenticated admin access assistant conversations" on public.assistant_conversations
      for all using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assistant_action_log' and policyname = 'Authenticated admin access assistant action log'
  ) then
    create policy "Authenticated admin access assistant action log" on public.assistant_action_log
      for all using (auth.role() = 'authenticated');
  end if;
end
$$;

drop trigger if exists assistant_conversations_updated_at on assistant_conversations;
create trigger assistant_conversations_updated_at
before update on assistant_conversations
for each row execute function update_updated_at_column();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'businesses',
    'customers',
    'jobs',
    'surveys',
    'quotes',
    'job_photos',
    'materials',
    'email_logs',
    'knowledge_base',
    'historical_quotes',
    'pricing_rules',
    'job_documents',
    'quote_attachments'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'Authenticated admin access'
    ) then
      execute format('create policy "Authenticated admin access" on public.%I for all using (auth.role() = ''authenticated'')', table_name);
    end if;
  end loop;
end
$$;
