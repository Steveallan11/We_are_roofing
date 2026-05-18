alter table customers
  add column if not exists customer_type text not null default 'person',
  add column if not exists business_name text,
  add column if not exists contact_person_name text,
  add column if not exists contact_person_phone text,
  add column if not exists contact_person_email text;

alter table customers
  drop constraint if exists customers_customer_type_check;

alter table customers
  add constraint customers_customer_type_check
  check (customer_type in ('person', 'business'));
