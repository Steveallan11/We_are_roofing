create table if not exists public.survey_videos (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid references public.surveys(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  storage_path text not null,
  file_name text,
  file_size_bytes bigint,
  duration_sec int,
  label text,
  frames_extracted int default 0,
  transcript text,
  ai_analysis jsonb,
  status text default 'pending'
    check (status in ('pending', 'processing', 'complete', 'failed')),
  error_message text,
  created_at timestamptz default now()
);

alter table public.survey_videos enable row level security;

do $$
begin
  create policy "Admin access" on public.survey_videos
    for all using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated upload survey videos" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'survey-videos');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated read survey videos" on storage.objects
    for select to authenticated
    using (bucket_id = 'survey-videos');
exception
  when duplicate_object then null;
end $$;
