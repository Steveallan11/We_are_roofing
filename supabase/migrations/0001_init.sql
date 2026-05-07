create extension if not exists "pgcrypto";

create type job_status as enum (
  'New Lead',
  'Survey Needed',
  'Survey Complete',
  'Ready For AI Quote',
  'Quote Drafted',
  'Ready To Send',
  'Quote Sent',
  'Follow-Up Needed',
  'Accepted',
  'Materials Needed',
  'Booked',
  'Completed',
  'Lost',
  'Archived'
);

create type quote_status as enum ('Draft', 'Needs Review', 'Approved', 'Sent', 'Accepted', 'Declined');
create type photo_type as enum ('General', 'Damage', 'Roof Area', 'Access', 'Scaffold', 'Before', 'After', 'Other');
create type required_status as enum ('Definitely Needed', 'May Be Needed', 'Optional', 'Check On Site');
create type knowledge_base_category as enum (
  'Quote Template',
  'Pricing Reference',
  'Scope Of Works',
  'Roof Report Style',
  'Materials System',
  'Terms',
  'Historical Quote',
  'Email Style',
  'Supplier Info'
);

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  trading_address text,
  phone text,
  email text,
  website text,
  logo_url text,
  vat_registered boolean not null default true,
  vat_rate numeric(5,2) not null default 20,
  company_number text,
  payment_terms text,
  quote_valid_days integer not null default 30,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text not null,
  phone text,
  email text,
  address_line_1 text,
  address_line_2 text,
  town text,
  county text,
  postcode text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  job_title text not null,
  property_address text not null,
  postcode text,
  job_type text,
  roof_type text,
  status job_status not null default 'New Lead',
  urgency text,
  source text,
  survey_date timestamptz,
  quote_sent_at timestamptz,
  follow_up_date timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  estimated_value numeric(12,2),
  final_value numeric(12,2),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  surveyor_name text,
  access_notes text,
  scaffold_required boolean not null default false,
  scaffold_notes text,
  roof_condition text,
  problem_observed text,
  suspected_cause text,
  recommended_works text,
  measurements text,
  weather_notes text,
  safety_notes text,
  customer_concerns text,
  voice_note_transcript text,
  raw_notes text,
  survey_type text,
  roof_type text,
  no_photo_confirmation boolean not null default false,
  adaptive_sections jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  survey_id uuid references surveys(id) on delete set null,
  storage_path text not null,
  public_url text,
  photo_type photo_type not null default 'General',
  caption text,
  uploaded_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  quote_ref text not null,
  version_number integer not null default 1,
  roof_report text not null,
  scope_of_works text not null,
  cost_breakdown jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  guarantee_text text,
  exclusions text,
  terms text,
  customer_email_subject text,
  customer_email_body text,
  status quote_status not null default 'Draft',
  pdf_url text,
  sent_at timestamptz,
  missing_info jsonb not null default '[]'::jsonb,
  pricing_notes jsonb not null default '[]'::jsonb,
  confidence text,
  model_name text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  item_name text not null,
  category text,
  quantity numeric(12,2),
  unit text,
  required_status required_status not null default 'Check On Site',
  notes text,
  supplier text,
  estimated_price numeric(12,2),
  link text,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  category knowledge_base_category not null,
  content text not null,
  source_type text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  provider_message_id text,
  sent_at timestamptz not null default now(),
  status text not null
);

create index if not exists jobs_business_status_idx on jobs (business_id, status);
create index if not exists quotes_job_status_idx on quotes (job_id, status);
create index if not exists materials_job_quote_idx on materials (job_id, quote_id);
create index if not exists knowledge_base_business_category_idx on knowledge_base (business_id, category);

