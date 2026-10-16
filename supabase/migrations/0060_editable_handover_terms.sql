alter table public.job_completion_details
  add column if not exists warranty_conditions text,
  add column if not exists warranty_claim_process text;
