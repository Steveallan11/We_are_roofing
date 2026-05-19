alter table if exists public.roof_surveys
  add column if not exists bounds jsonb;
