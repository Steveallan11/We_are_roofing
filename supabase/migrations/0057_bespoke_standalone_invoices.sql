-- Standalone invoices may still have generated PDF/HTML invoice documents.
-- Their invoice_id is the owner; a job link is optional.
alter table public.job_documents
  alter column job_id drop not null;

create index if not exists invoices_business_customer_idx
  on public.invoices (business_id, customer_id, created_at desc);
