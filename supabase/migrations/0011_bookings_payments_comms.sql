alter table public.jobs
  add column if not exists start_date date,
  add column if not exists expected_end_date date,
  add column if not exists actual_end_date date,
  add column if not exists survey_time time,
  add column if not exists survey_duration int default 60,
  add column if not exists survey_confirmed boolean default false,
  add column if not exists survey_notes text,
  add column if not exists survey_address text;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id),
  job_id uuid references public.jobs(id) on delete cascade,
  booking_type text not null check (booking_type in ('survey','start','inspection','other')),
  title text,
  date date not null,
  time_start time,
  time_end time,
  duration_mins int default 60,
  address text,
  postcode text,
  notes text,
  status text default 'confirmed' check (status in ('tentative','confirmed','completed','cancelled','rescheduled')),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  reschedule_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bookings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'Admin access bookings'
  ) then
    create policy "Admin access bookings"
      on public.bookings
      for all
      using (auth.role() = 'authenticated');
  end if;
end $$;

create table if not exists public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  quote_id uuid references public.quotes(id),
  business_id uuid references public.businesses(id),
  created_at timestamptz default now()
);

alter table public.payment_schedules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_schedules'
      and policyname = 'Admin access payment schedules'
  ) then
    create policy "Admin access payment schedules"
      on public.payment_schedules
      for all
      using (auth.role() = 'authenticated');
  end if;
end $$;

create table if not exists public.payment_stages (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.payment_schedules(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  stage_name text not null,
  stage_number int not null,
  percentage numeric,
  amount numeric,
  due_trigger text,
  due_date date,
  status text default 'pending' check (status in ('pending','invoiced','paid','overdue')),
  invoice_id uuid,
  paid_at timestamptz,
  payment_ref text,
  notes text,
  created_at timestamptz default now()
);

alter table public.payment_stages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_stages'
      and policyname = 'Admin access payment stages'
  ) then
    create policy "Admin access payment stages"
      on public.payment_stages
      for all
      using (auth.role() = 'authenticated');
  end if;
end $$;

alter table public.email_logs
  add column if not exists template_type text,
  add column if not exists channel text default 'email' check (channel in ('email','sms')),
  add column if not exists to_phone text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists resend_id text,
  add column if not exists twilio_sid text,
  add column if not exists sequence_day int;

create table if not exists public.nurture_sequences (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  quote_id uuid references public.quotes(id),
  triggered_at timestamptz default now(),
  status text default 'active' check (status in ('active','paused','completed','cancelled')),
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text
);

alter table public.nurture_sequences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nurture_sequences'
      and policyname = 'Admin access nurture sequences'
  ) then
    create policy "Admin access nurture sequences"
      on public.nurture_sequences
      for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
