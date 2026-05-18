alter table public.surveys
  add column if not exists source_type text default 'manual'
    check (source_type in ('manual','video','voice','glasses_import')),
  add column if not exists video_path text,
  add column if not exists video_duration_sec int,
  add column if not exists frames_extracted int,
  add column if not exists frame_paths jsonb default '[]'::jsonb,
  add column if not exists ai_confidence numeric,
  add column if not exists ai_raw_response jsonb,
  add column if not exists processing_status text default 'complete'
    check (processing_status in ('pending','processing','complete','failed')),
  add column if not exists processing_error text;
