alter table public.job_completion_details
  add column if not exists warranty_years integer not null default 15,
  add column if not exists warranty_details text;
