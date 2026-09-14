alter table public.invoices
  add column if not exists cis_deduction_rate numeric(5,2) not null default 0
    check (cis_deduction_rate in (0, 20, 30)),
  add column if not exists cis_labour_amount numeric(12,2) not null default 0,
  add column if not exists cis_deduction_amount numeric(12,2) not null default 0;

comment on column public.invoices.cis_labour_amount is
  'VAT-exclusive labour amount used as the basis for the CIS deduction.';

comment on column public.invoices.cis_deduction_amount is
  'CIS withheld by the customer from the amount payable; materials and VAT are excluded from this calculation.';
