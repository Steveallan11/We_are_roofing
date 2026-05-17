alter table job_documents
  add column if not exists invoice_id uuid references invoices(id) on delete set null;

create index if not exists job_documents_invoice_idx on job_documents (invoice_id);
