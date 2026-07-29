alter table public.materials
  add column if not exists vat_applicable boolean not null default true,
  add column if not exists actual_vat_amount numeric(12,2) not null default 0;

alter table public.job_expenses
  add column if not exists cis_applicable boolean not null default false,
  add column if not exists cis_rate numeric(5,4) not null default 0.20,
  add column if not exists cis_deduction numeric(12,2) not null default 0;
