alter table public.quotes
  add column if not exists customer_pricing_mode text;

update public.quotes
set customer_pricing_mode = case
  when jsonb_typeof(coalesce(options, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(options, '[]'::jsonb)) >= 2 then 'options'
  else 'single'
end
where customer_pricing_mode is null;

alter table public.quotes
  alter column customer_pricing_mode set default 'single',
  alter column customer_pricing_mode set not null;

alter table public.quotes
  drop constraint if exists quotes_customer_pricing_mode_check;

alter table public.quotes
  add constraint quotes_customer_pricing_mode_check
  check (customer_pricing_mode in ('single', 'options', 'selectable_items'));

comment on column public.quotes.customer_pricing_mode is
  'Controls the customer-facing pricing choice: one fixed quote, mutually exclusive A/B options, or individually selectable work items.';
