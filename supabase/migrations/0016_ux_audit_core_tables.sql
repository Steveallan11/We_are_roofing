create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id),
  customer_id uuid references public.customers(id),
  job_id uuid references public.jobs(id),
  quote_id uuid references public.quotes(id),
  primary_channel text not null default 'platform'
    check (primary_channel in ('email','sms','whatsapp','google_business','facebook','instagram','platform')),
  subject text,
  status text default 'open' check (status in ('open','snoozed','resolved','spam')),
  unread_count int default 0,
  last_message_at timestamptz,
  last_message_preview text,
  assigned_to text default 'Andy',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  channel text not null default 'platform'
    check (channel in ('email','sms','whatsapp','google_business','facebook','instagram','platform')),
  sender_type text not null check (sender_type in ('customer','admin','system','ai')),
  sender_name text,
  sender_email text,
  sender_phone text,
  body text not null,
  subject text,
  html_body text,
  attachments jsonb default '[]'::jsonb,
  provider text,
  provider_msg_id text,
  status text default 'sent',
  sent_at timestamptz default now(),
  read_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  quote_id uuid references public.quotes(id),
  business_id uuid references public.businesses(id),
  invoice_ref text unique,
  status text default 'Outstanding'
    check (status in ('Draft','Outstanding','Overdue','Paid','Cancelled')),
  subtotal numeric default 0,
  vat_amount numeric default 0,
  total numeric default 0,
  description text,
  due_date date,
  paid_at timestamptz,
  notes text,
  sent_at timestamptz,
  sent_to_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.invoices enable row level security;

do $$
begin
  create policy "Admin access" on public.conversations for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create policy "Admin access" on public.messages for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create policy "Customer inbound" on public.messages for insert with check (direction = 'inbound' and sender_type = 'customer');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create policy "Admin access" on public.invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null;
end;
$$;

create or replace function public.generate_invoice_ref()
returns trigger as $$
declare next_num int;
begin
  select coalesce(max(cast(regexp_replace(invoice_ref,'[^0-9]','','g') as int)),0)+1
  into next_num from public.invoices where business_id = new.business_id;
  new.invoice_ref := 'WR-INV-' || lpad(next_num::text, 4, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_invoice_ref on public.invoices;
create trigger set_invoice_ref
  before insert on public.invoices for each row
  when (new.invoice_ref is null)
  execute function public.generate_invoice_ref();
