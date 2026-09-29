-- Allow reviewed communication drafts to include files already stored on the
-- related job (invoices, quotes, roof reports and uploaded documents).
alter table public.communication_drafts
  add column if not exists job_document_ids uuid[] not null default '{}'::uuid[];

comment on column public.communication_drafts.job_document_ids is
  'Job document IDs selected for this reviewed email draft. Ownership is validated in the application before save and send.';

notify pgrst, 'reload schema';
