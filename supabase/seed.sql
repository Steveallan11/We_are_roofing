insert into businesses (
  id,
  business_name,
  trading_address,
  phone,
  email,
  website,
  vat_registered,
  vat_rate,
  company_number,
  payment_terms,
  quote_valid_days
)
values (
  '11111111-1111-1111-1111-111111111111',
  'We Are Roofing UK Ltd',
  'Yateley, Hampshire, GU46',
  '01252 000000',
  'hello@weareroofing.co.uk',
  'https://weareroofing.co.uk',
  true,
  20,
  'PLACEHOLDER',
  'Payment terms are strictly upon receipt of invoice',
  30
)
on conflict (id) do nothing;

