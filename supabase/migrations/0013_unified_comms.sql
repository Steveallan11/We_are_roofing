create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  primary_channel text not null check (primary_channel in ('email','sms','whatsapp','google_business','facebook','instagram','platform')),
  subject text,
  status text not null default 'open' check (status in ('open','snoozed','resolved','spam')),
  unread_count int not null default 0,
  last_message_at timestamptz,
  last_message_preview text,
  snoozed_until timestamptz,
  assigned_to text default 'Andy',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  channel text not null check (channel in ('email','sms','whatsapp','google_business','facebook','instagram','platform')),
  sender_type text not null check (sender_type in ('customer','admin','system','ai')),
  sender_name text,
  sender_email text,
  sender_phone text,
  body text not null,
  subject text,
  html_body text,
  attachments jsonb not null default '[]'::jsonb,
  provider text,
  provider_msg_id text,
  status text not null default 'sent' check (status in ('pending','sent','delivered','read','failed')),
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  channel text not null check (channel in ('gmail','outlook','whatsapp','google_business','facebook','instagram','twilio')),
  account_name text,
  account_id text,
  access_token text,
  refresh_token text,
  token_expires timestamptz,
  webhook_secret text,
  status text not null default 'active' check (status in ('active','error','disconnected')),
  last_sync timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  category text,
  channels text[],
  subject text,
  body text not null,
  is_auto boolean not null default false,
  trigger_event text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists conversations_business_updated_idx on public.conversations (business_id, updated_at desc);
create index if not exists conversations_customer_channel_idx on public.conversations (customer_id, primary_channel, status);
create index if not exists messages_conversation_sent_idx on public.messages (conversation_id, sent_at asc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.channel_connections enable row level security;
alter table public.message_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations' and policyname = 'Authenticated admin access conversations'
  ) then
    create policy "Authenticated admin access conversations"
      on public.conversations for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages' and policyname = 'Authenticated admin access messages'
  ) then
    create policy "Authenticated admin access messages"
      on public.messages for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages' and policyname = 'Customer inbound messages'
  ) then
    create policy "Customer inbound messages"
      on public.messages for insert
      with check (direction = 'inbound' and sender_type = 'customer');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'channel_connections' and policyname = 'Authenticated admin access channel connections'
  ) then
    create policy "Authenticated admin access channel connections"
      on public.channel_connections for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'message_templates' and policyname = 'Authenticated admin access message templates'
  ) then
    create policy "Authenticated admin access message templates"
      on public.message_templates for all
      using (auth.role() = 'authenticated');
  end if;
end
$$;

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
before update on public.conversations
for each row execute function update_updated_at_column();

insert into public.message_templates (business_id, name, category, channels, subject, body, is_auto, trigger_event)
values
  (
    '6f9a6dca-a747-4a20-ab87-111808577bc7',
    'Survey Confirmation',
    'survey',
    array['email','sms'],
    'Your roof survey is confirmed - {{job_ref}}',
    'Hi {{first_name}}, your roof survey is confirmed for {{survey_date}} at {{survey_time}} at {{address}}. Our surveyor {{surveyor_name}} will be with you then. Any questions call 01252 000000. We Are Roofing',
    true,
    'survey_booked'
  ),
  (
    '6f9a6dca-a747-4a20-ab87-111808577bc7',
    'Survey Reminder',
    'survey',
    array['sms'],
    null,
    'Hi {{first_name}}, reminder: your roof survey is tomorrow at {{survey_time}}. We Are Roofing 01252 000000',
    true,
    'survey_day_before'
  ),
  (
    '6f9a6dca-a747-4a20-ab87-111808577bc7',
    'Quote Follow-Up Day 2',
    'nurture',
    array['email'],
    'Any questions about your quote, {{first_name}}?',
    'Hi {{first_name}}, just checking in on the quote we sent for the works at {{address}}. Happy to talk through anything or answer any questions - just reply here or call 01252 000000. Andy @ We Are Roofing',
    true,
    'quote_sent_day_2'
  ),
  (
    '6f9a6dca-a747-4a20-ab87-111808577bc7',
    'Works Starting Tomorrow',
    'works',
    array['sms','whatsapp'],
    null,
    'Hi {{first_name}}, our team will be at {{address}} tomorrow at {{start_time}} to start your roofing works. Any questions call 01252 000000. Andy @ We Are Roofing',
    false,
    null
  ),
  (
    '6f9a6dca-a747-4a20-ab87-111808577bc7',
    'Request Google Review',
    'review',
    array['sms','email'],
    'Thank you from We Are Roofing - would you leave us a review?',
    'Hi {{first_name}}, thank you for choosing We Are Roofing. If you were happy with the work, a Google review would mean a lot: https://g.page/r/weareroofing/review. Thank you, Andy',
    true,
    'job_completed'
  )
on conflict do nothing;
