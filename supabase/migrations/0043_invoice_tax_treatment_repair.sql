-- Idempotent repair for invoice VAT reverse-charge and CIS fields.
-- Safe to run if migrations 0041 and/or 0042 were already applied.

alter table public.invoices
  add column if not exists vat_treatment text not null default 'standard',
  add column if not exists reverse_charge_vat_amount numeric(12,2) not null default 0,
  add column if not exists customer_vat_number text,
  add column if not exists reverse_charge_confirmed_at timestamptz,
  add column if not exists cis_deduction_rate numeric(5,2) not null default 0,
  add column if not exists cis_labour_amount numeric(12,2) not null default 0,
  add column if not exists cis_deduction_amount numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_vat_treatment_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_vat_treatment_check
      check (vat_treatment in ('standard', 'domestic_reverse_charge'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_cis_deduction_rate_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_cis_deduction_rate_check
      check (cis_deduction_rate in (0, 20, 30));
  end if;
end $$;

comment on column public.invoices.vat_treatment is
  'standard charges VAT to the customer; domestic_reverse_charge makes the customer account for VAT.';
comment on column public.invoices.reverse_charge_vat_amount is
  'VAT the customer accounts for to HMRC under domestic reverse charge.';
comment on column public.invoices.cis_labour_amount is
  'VAT-exclusive labour amount used as the basis for CIS.';
comment on column public.invoices.cis_deduction_amount is
  'CIS withheld by the customer from the amount payable.';

notify pgrst, 'reload schema';
