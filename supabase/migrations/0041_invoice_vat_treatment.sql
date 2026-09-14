alter table public.invoices
  add column if not exists vat_treatment text not null default 'standard'
    check (vat_treatment in ('standard', 'domestic_reverse_charge')),
  add column if not exists reverse_charge_vat_amount numeric(12,2) not null default 0,
  add column if not exists customer_vat_number text,
  add column if not exists reverse_charge_confirmed_at timestamptz;

comment on column public.invoices.vat_treatment is
  'standard charges VAT to the customer; domestic_reverse_charge shows VAT for the customer to account for but excludes it from the amount due.';

comment on column public.invoices.reverse_charge_vat_amount is
  'VAT amount the customer must account for to HMRC when domestic reverse charge applies; never included in invoice total or balance due.';
