with ranked as (
  select
    id,
    row_number() over (
      partition by business_id, lower(name)
      order by created_at asc, id asc
    ) as duplicate_number
  from public.message_templates
)
delete from public.message_templates
where id in (select id from ranked where duplicate_number > 1);

create unique index if not exists message_templates_business_name_unique_idx
  on public.message_templates (business_id, lower(name));

notify pgrst, 'reload schema';
