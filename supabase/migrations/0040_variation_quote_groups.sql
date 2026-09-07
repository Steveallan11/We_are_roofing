-- Link multiple additional-work items into one customer quotation and approval.

alter table public.job_variations
  add column if not exists approval_group_id uuid,
  add column if not exists approval_group_ref text;

create index if not exists job_variations_approval_group_idx
  on public.job_variations (approval_group_id)
  where approval_group_id is not null;
