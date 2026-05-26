create table if not exists public.job_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  document_type text not null,
  display_name text not null,
  storage_bucket text,
  storage_path text,
  public_url text,
  source_type text not null default 'generated',
  mime_type text,
  file_size integer,
  content_html text,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_attachments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  job_photo_id uuid references public.job_photos(id) on delete set null,
  job_document_id uuid references public.job_documents(id) on delete set null,
  attachment_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists job_documents_job_quote_idx on public.job_documents (job_id, quote_id);
create index if not exists quote_attachments_quote_idx on public.quote_attachments (quote_id);
create index if not exists quote_attachments_job_document_idx on public.quote_attachments (job_document_id);

do $$
begin
  if to_regclass('public.invoices') is not null then
    alter table public.job_documents
      add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

    create index if not exists job_documents_invoice_idx on public.job_documents (invoice_id);
    create unique index if not exists job_documents_job_invoice_type_idx
      on public.job_documents (job_id, invoice_id, document_type)
      where invoice_id is not null;
  end if;
end
$$;

alter table public.job_documents enable row level security;
alter table public.quote_attachments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'job_documents'
      and policyname = 'Authenticated admin access'
  ) then
    create policy "Authenticated admin access" on public.job_documents
      for all using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quote_attachments'
      and policyname = 'Authenticated admin access'
  ) then
    create policy "Authenticated admin access" on public.quote_attachments
      for all using (auth.role() = 'authenticated');
  end if;
end
$$;

notify pgrst, 'reload schema';
