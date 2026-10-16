alter table public.job_completion_details
  add column if not exists installed_system text,
  add column if not exists product_details text;
