create table if not exists public.job_expense_documents (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.job_expenses(id) on delete cascade,
  document_id uuid not null references public.job_documents(id) on delete cascade,
  document_role text not null default 'receipt',
  created_at timestamptz not null default now(),
  unique (expense_id, document_id)
);

create index if not exists job_expense_documents_expense_idx
  on public.job_expense_documents (expense_id);

create index if not exists job_expense_documents_document_idx
  on public.job_expense_documents (document_id);

alter table public.job_expense_documents enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'job_expense_documents'
      and policyname = 'Authenticated admin access job expense documents'
  ) then
    create policy "Authenticated admin access job expense documents"
      on public.job_expense_documents
      for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
