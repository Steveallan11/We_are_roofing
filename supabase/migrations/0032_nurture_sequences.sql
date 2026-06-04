-- Nurture email sequence tracking
-- Tracks which day of a post-quote follow-up sequence a customer is on
-- Helps encourage quote acceptance through timed follow-ups

create table if not exists public.nurture_sequences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  started_at timestamptz not null default now(),
  current_day integer not null default 0,
  last_email_sent_at timestamptz,
  completed_at timestamptz,
  completion_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Track which emails have been sent for each sequence
create table if not exists public.nurture_emails (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.nurture_sequences(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  day_number integer not null,
  template_name text not null,
  subject text not null,
  body text not null,
  customer_email text not null,
  status text not null default 'pending' check (status in ('pending','sent','delivered','failed','bounced','opened','clicked')),
  sent_at timestamptz,
  delivery_status_checked_at timestamptz,
  message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create indexes for efficient querying
create index if not exists nurture_sequences_quote_idx on public.nurture_sequences (quote_id);
create index if not exists nurture_sequences_business_started_idx on public.nurture_sequences (business_id, started_at desc);
create index if not exists nurture_sequences_completed_idx on public.nurture_sequences (completed_at) where completed_at is null;
create index if not exists nurture_emails_sequence_idx on public.nurture_emails (sequence_id);
create index if not exists nurture_emails_day_status_idx on public.nurture_emails (day_number, status);

alter table public.nurture_sequences enable row level security;
alter table public.nurture_emails enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nurture_sequences' and policyname = 'Authenticated admin access nurture_sequences'
  ) then
    create policy "Authenticated admin access nurture_sequences"
      on public.nurture_sequences for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nurture_emails' and policyname = 'Authenticated admin access nurture_emails'
  ) then
    create policy "Authenticated admin access nurture_emails"
      on public.nurture_emails for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
