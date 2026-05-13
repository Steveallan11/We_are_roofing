create table if not exists roof_surveys (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  project_name text,
  scale_px_per_m double precision,
  satellite_image_path text,
  notes text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roof_survey_sections (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references roof_surveys(id) on delete cascade,
  label text,
  type text,
  condition text,
  color text,
  points jsonb not null default '[]'::jsonb,
  area_m2 double precision,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists roof_survey_lines (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references roof_surveys(id) on delete cascade,
  label text,
  type text,
  color text,
  points jsonb not null default '[]'::jsonb,
  length_lm double precision,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists roof_survey_features (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references roof_surveys(id) on delete cascade,
  label text,
  type text,
  color text,
  point jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists roof_surveys_job_idx on roof_surveys (job_id, created_at desc);
create index if not exists roof_survey_sections_survey_idx on roof_survey_sections (survey_id, sort_order);
create index if not exists roof_survey_lines_survey_idx on roof_survey_lines (survey_id, sort_order);
create index if not exists roof_survey_features_survey_idx on roof_survey_features (survey_id);

alter table roof_surveys enable row level security;
alter table roof_survey_sections enable row level security;
alter table roof_survey_lines enable row level security;
alter table roof_survey_features enable row level security;

create policy "Admin access roof surveys" on roof_surveys for all using (auth.role() = 'authenticated');
create policy "Admin access roof survey sections" on roof_survey_sections for all using (auth.role() = 'authenticated');
create policy "Admin access roof survey lines" on roof_survey_lines for all using (auth.role() = 'authenticated');
create policy "Admin access roof survey features" on roof_survey_features for all using (auth.role() = 'authenticated');

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists roof_surveys_updated_at on roof_surveys;
create trigger roof_surveys_updated_at
before update on roof_surveys
for each row execute function update_updated_at_column();
