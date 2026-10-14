-- MCP survey edits must preserve unassessed boolean values and may only update
-- an existing survey. Keep these columns nullable so NULL can mean "unknown".
alter table public.surveys alter column scaffold_required drop not null;
alter table public.surveys alter column no_photo_confirmation drop not null;

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
  select * into target_job from public.jobs
    where business_id=p_business_id and job_ref=p_job_ref for update;
  if not found then raise exception 'Job not found in this workspace.'; end if;
  if p_source_document_id is not null and not exists (
    select 1 from public.job_documents where id=p_source_document_id and job_id=target_job.id
  ) then raise exception 'Source document does not belong to this job.'; end if;

  select * into target_survey from public.surveys
    where job_id=target_job.id order by created_at desc limit 1 for update;
  if not found then
    raise exception 'This job has no existing survey to update. Create it through the normal OS survey workflow first.';
  end if;
  if p_expected_updated_at is null or target_survey.updated_at <> p_expected_updated_at then
    raise exception 'The survey changed after preview. Refresh and preview again.';
  end if;

  -- The service sends a merged target. These CASE expressions also make the
  -- database operation safe if a future caller sends only a partial payload.
  update public.surveys set
    surveyor_name=case when p_target ? 'surveyor_name' then p_target->>'surveyor_name' else target_survey.surveyor_name end,
    access_notes=case when p_target ? 'access_notes' then p_target->>'access_notes' else target_survey.access_notes end,
    scaffold_required=case when p_target ? 'scaffold_required' then (p_target->>'scaffold_required')::boolean else target_survey.scaffold_required end,
    scaffold_notes=case when p_target ? 'scaffold_notes' then p_target->>'scaffold_notes' else target_survey.scaffold_notes end,
    roof_condition=case when p_target ? 'roof_condition' then p_target->>'roof_condition' else target_survey.roof_condition end,
    problem_observed=case when p_target ? 'problem_observed' then p_target->>'problem_observed' else target_survey.problem_observed end,
    suspected_cause=case when p_target ? 'suspected_cause' then p_target->>'suspected_cause' else target_survey.suspected_cause end,
    recommended_works=case when p_target ? 'recommended_works' then p_target->>'recommended_works' else target_survey.recommended_works end,
    measurements=case when p_target ? 'measurements' then p_target->>'measurements' else target_survey.measurements end,
    weather_notes=case when p_target ? 'weather_notes' then p_target->>'weather_notes' else target_survey.weather_notes end,
    safety_notes=case when p_target ? 'safety_notes' then p_target->>'safety_notes' else target_survey.safety_notes end,
    customer_concerns=case when p_target ? 'customer_concerns' then p_target->>'customer_concerns' else target_survey.customer_concerns end,
    voice_note_transcript=case when p_target ? 'voice_note_transcript' then p_target->>'voice_note_transcript' else target_survey.voice_note_transcript end,
    raw_notes=case when p_target ? 'raw_notes' then p_target->>'raw_notes' else target_survey.raw_notes end,
    survey_type=case when p_target ? 'survey_type' then p_target->>'survey_type' else target_survey.survey_type end,
    roof_type=case when p_target ? 'roof_type' then p_target->>'roof_type' else target_survey.roof_type end,
    no_photo_confirmation=case when p_target ? 'no_photo_confirmation' then (p_target->>'no_photo_confirmation')::boolean else target_survey.no_photo_confirmation end,
    enabled_modules=case when p_target ? 'enabled_modules' then p_target->'enabled_modules' else target_survey.enabled_modules end,
    adaptive_sections=case when p_target ? 'adaptive_sections' then p_target->'adaptive_sections' else target_survey.adaptive_sections end,
    updated_at=now()
  where id=target_survey.id returning * into target_survey;

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
