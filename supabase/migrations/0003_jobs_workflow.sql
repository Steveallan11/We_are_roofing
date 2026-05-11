alter table jobs
  add column if not exists job_ref text;

with ordered_jobs as (
  select
    id,
    'WR-J-' || lpad((1000 + row_number() over (order by created_at asc, id asc))::text, 4, '0') as generated_job_ref
  from jobs
)
update jobs
set job_ref = ordered_jobs.generated_job_ref
from ordered_jobs
where jobs.id = ordered_jobs.id
  and jobs.job_ref is null;

create unique index if not exists jobs_business_job_ref_idx
  on jobs (business_id, job_ref);
