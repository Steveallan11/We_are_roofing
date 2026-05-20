alter table if exists public.quotes
  add column if not exists public_token text,
  add column if not exists public_token_created_at timestamptz;

create unique index if not exists quotes_public_token_idx
  on public.quotes (public_token)
  where public_token is not null;
