-- Additive multi-module survey support and field-level import provenance.
alter table if exists public.surveys
  add column if not exists enabled_modules jsonb not null default '[]'::jsonb;

update public.surveys
set enabled_modules = jsonb_build_array(
  case survey_type
    when 'Pitched / Tiled' then 'pitched_roof'
    when 'Flat Roof' then 'flat_roof'
    when 'Fascias / Soffits / Gutters' then 'fascias'
    when 'Chimney / Lead' then 'chimney'
    else 'other'
  end
)
where enabled_modules = '[]'::jsonb and survey_type is not null;

create table if not exists public.survey_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  survey_id uuid not null references public.surveys(id) on delete cascade,
  source_document_id uuid references public.job_documents(id) on delete set null,
  source_type text not null default 'roof_report' check (source_type in ('roof_report','job_document','video','photo','chatgpt_import','other')),
  status text not null default 'Applied' check (status in ('Applied','Superseded','Failed')),
  summary text,
  applied_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_field_evidence (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  survey_id uuid not null references public.surveys(id) on delete cascade,
  import_id uuid references public.survey_imports(id) on delete set null,
  source_document_id uuid references public.job_documents(id) on delete set null,
  field_path text not null,
  value jsonb,
  source_type text not null default 'roof_report',
  source_page integer check (source_page is null or source_page > 0),
  source_excerpt text,
  evidence_class text not null default 'CONFIRMED' check (evidence_class in ('CONFIRMED','SURVEYOR_STATED','MEASURED','APPROXIMATE','INFERRED','UNKNOWN')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  verified boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists survey_imports_business_job_idx on public.survey_imports (business_id, job_id, created_at desc);
create index if not exists survey_field_evidence_survey_path_idx on public.survey_field_evidence (survey_id, field_path, created_at desc);
create index if not exists survey_field_evidence_business_job_idx on public.survey_field_evidence (business_id, job_id);

alter table public.survey_imports enable row level security;
alter table public.survey_field_evidence enable row level security;

drop policy if exists "Authenticated survey imports" on public.survey_imports;
create policy "Authenticated survey imports" on public.survey_imports for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated survey field evidence" on public.survey_field_evidence;
create policy "Authenticated survey field evidence" on public.survey_field_evidence for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create or replace function public.enforce_survey_import_scope()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.jobs where id=new.job_id and business_id=new.business_id) then
    raise exception 'Job does not belong to this business.';
  end if;
  if not exists (select 1 from public.surveys where id=new.survey_id and job_id=new.job_id) then
    raise exception 'Survey does not belong to this job.';
  end if;
  if new.source_document_id is not null and not exists (
    select 1 from public.job_documents where id=new.source_document_id and job_id=new.job_id
  ) then raise exception 'Source document does not belong to this job.'; end if;
  return new;
end $$;

drop trigger if exists survey_import_scope on public.survey_imports;
create trigger survey_import_scope before insert or update of business_id,job_id,survey_id,source_document_id
on public.survey_imports for each row execute function public.enforce_survey_import_scope();

drop trigger if exists survey_evidence_scope on public.survey_field_evidence;
create trigger survey_evidence_scope before insert or update of business_id,job_id,survey_id,source_document_id
on public.survey_field_evidence for each row execute function public.enforce_survey_import_scope();

create or replace function public.apply_structured_survey_import(
  p_business_id uuid,
  p_job_ref text,
  p_expected_updated_at timestamptz,
  p_target jsonb,
  p_evidence jsonb default '[]'::jsonb,
  p_source_document_id uuid default null,
  p_source_type text default 'roof_report',
  p_summary text default null,
  p_actor_id text default null
) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare
  target_job public.jobs%rowtype;
  target_survey public.surveys%rowtype;
  import_row public.survey_imports%rowtype;
  item jsonb;
begin
  select * into target_job from public.jobs where business_id=p_business_id and job_ref=p_job_ref for update;
  if not found then raise exception 'Job not found in this workspace.'; end if;
  if p_source_document_id is not null and not exists (
    select 1 from public.job_documents where id=p_source_document_id and job_id=target_job.id
  ) then raise exception 'Source document does not belong to this job.'; end if;

  select * into target_survey from public.surveys where job_id=target_job.id order by created_at desc limit 1 for update;
  if found then
    if p_expected_updated_at is null or target_survey.updated_at <> p_expected_updated_at then
      raise exception 'The survey changed after preview. Refresh and preview again.';
    end if;
    update public.surveys set
      surveyor_name=p_target->>'surveyor_name', access_notes=p_target->>'access_notes',
      scaffold_required=coalesce((p_target->>'scaffold_required')::boolean,false), scaffold_notes=p_target->>'scaffold_notes',
      roof_condition=p_target->>'roof_condition', problem_observed=p_target->>'problem_observed', suspected_cause=p_target->>'suspected_cause',
      recommended_works=p_target->>'recommended_works', measurements=p_target->>'measurements', weather_notes=p_target->>'weather_notes',
      safety_notes=p_target->>'safety_notes', customer_concerns=p_target->>'customer_concerns', voice_note_transcript=p_target->>'voice_note_transcript',
      raw_notes=p_target->>'raw_notes', survey_type=p_target->>'survey_type', roof_type=p_target->>'roof_type',
      no_photo_confirmation=coalesce((p_target->>'no_photo_confirmation')::boolean,false),
      enabled_modules=coalesce(p_target->'enabled_modules','[]'::jsonb), adaptive_sections=coalesce(p_target->'adaptive_sections','{}'::jsonb), updated_at=now()
    where id=target_survey.id returning * into target_survey;
  else
    if p_expected_updated_at is not null then raise exception 'The survey no longer matches the preview.'; end if;
    insert into public.surveys (
      job_id,surveyor_name,access_notes,scaffold_required,scaffold_notes,roof_condition,problem_observed,suspected_cause,recommended_works,
      measurements,weather_notes,safety_notes,customer_concerns,voice_note_transcript,raw_notes,survey_type,roof_type,no_photo_confirmation,enabled_modules,adaptive_sections
    ) values (
      target_job.id,p_target->>'surveyor_name',p_target->>'access_notes',coalesce((p_target->>'scaffold_required')::boolean,false),p_target->>'scaffold_notes',
      p_target->>'roof_condition',p_target->>'problem_observed',p_target->>'suspected_cause',p_target->>'recommended_works',p_target->>'measurements',
      p_target->>'weather_notes',p_target->>'safety_notes',p_target->>'customer_concerns',p_target->>'voice_note_transcript',p_target->>'raw_notes',
      p_target->>'survey_type',p_target->>'roof_type',coalesce((p_target->>'no_photo_confirmation')::boolean,false),
      coalesce(p_target->'enabled_modules','[]'::jsonb),coalesce(p_target->'adaptive_sections','{}'::jsonb)
    ) returning * into target_survey;
  end if;

  insert into public.survey_imports (business_id,job_id,survey_id,source_document_id,source_type,summary,applied_by)
  values (p_business_id,target_job.id,target_survey.id,p_source_document_id,p_source_type,p_summary,p_actor_id)
  returning * into import_row;

  for item in select value from jsonb_array_elements(coalesce(p_evidence,'[]'::jsonb)) loop
    insert into public.survey_field_evidence (
      business_id,job_id,survey_id,import_id,source_document_id,field_path,value,source_type,source_page,source_excerpt,evidence_class,confidence,verified,created_by
    ) values (
      p_business_id,target_job.id,target_survey.id,import_row.id,p_source_document_id,item->>'field_path',item->'value',p_source_type,
      nullif(item->>'source_page','')::integer,left(item->>'source_excerpt',1000),coalesce(item->>'evidence_class','CONFIRMED'),
      nullif(item->>'confidence','')::numeric,coalesce((item->>'verified')::boolean,false),p_actor_id
    );
  end loop;

  insert into public.job_activity (business_id,job_id,customer_id,activity_type,message,actor_type,actor_name,linked_entity_type,linked_entity_id,details)
  values (p_business_id,target_job.id,target_job.customer_id,'survey_imported','Structured survey imported from '||replace(p_source_type,'_',' '),'system',p_actor_id,'survey',target_survey.id,
    jsonb_build_object('import_id',import_row.id,'source_document_id',p_source_document_id,'evidence_fields',jsonb_array_length(coalesce(p_evidence,'[]'::jsonb))));

  return jsonb_build_object('survey_id',target_survey.id,'import_id',import_row.id,'updated_at',target_survey.updated_at,'job_ref',p_job_ref);
end $$;
