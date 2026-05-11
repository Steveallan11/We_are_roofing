create table if not exists historical_quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  source_reference text,
  source_record_id text,
  source_url text,
  source_type text not null default 'notion_import',
  source_date date,
  source_year integer,
  roof_type text,
  job_type text,
  tags jsonb not null default '[]'::jsonb,
  imported_text text not null,
  scope_excerpt text,
  materials_excerpt text,
  original_total numeric(12,2),
  uplifted_reference_total numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists historical_quotes_business_source_record_idx
  on historical_quotes (business_id, source_record_id);

create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  title text not null,
  year_from integer,
  year_to integer,
  roof_type text,
  job_type text,
  uplift_multiplier numeric(8,4) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists job_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  document_type text not null,
  display_name text not null,
  storage_bucket text,
  storage_path text,
  public_url text,
  source_type text not null default 'generated',
  mime_type text,
  file_size integer,
  content_html text,
  created_at timestamptz not null default now()
);

create table if not exists quote_attachments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  job_photo_id uuid references job_photos(id) on delete set null,
  job_document_id uuid references job_documents(id) on delete set null,
  attachment_type text not null,
  created_at timestamptz not null default now()
);

alter table job_photos
  add column if not exists file_size integer,
  add column if not exists mime_type text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists historical_quotes_business_year_idx on historical_quotes (business_id, source_year desc);
create index if not exists historical_quotes_business_tags_idx on historical_quotes using gin (tags);
create index if not exists pricing_rules_business_scope_idx on pricing_rules (business_id, year_from, year_to);
create index if not exists job_documents_job_quote_idx on job_documents (job_id, quote_id);
create index if not exists quote_attachments_quote_idx on quote_attachments (quote_id);
create unique index if not exists knowledge_base_business_title_category_source_idx
  on knowledge_base (business_id, title, category, source_type);

insert into pricing_rules (
  business_id,
  title,
  year_from,
  year_to,
  uplift_multiplier,
  notes
)
values
  ('11111111-1111-1111-1111-111111111111', '2021 quotes uplift', 2021, 2021, 1.24, 'Default uplift for older historical quotes'),
  ('11111111-1111-1111-1111-111111111111', '2022 quotes uplift', 2022, 2022, 1.18, 'Default uplift for 2022 historical quotes'),
  ('11111111-1111-1111-1111-111111111111', '2023 quotes uplift', 2023, 2023, 1.12, 'Default uplift for 2023 historical quotes'),
  ('11111111-1111-1111-1111-111111111111', '2024 quotes uplift', 2024, 2024, 1.08, 'Default uplift for 2024 historical quotes'),
  ('11111111-1111-1111-1111-111111111111', '2025 quotes uplift', 2025, 2025, 1.03, 'Default uplift for 2025 historical quotes')
on conflict do nothing;
