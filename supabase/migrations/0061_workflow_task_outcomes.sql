ALTER TABLE public.diary_entries
  ADD COLUMN IF NOT EXISTS task_outcome text,
  ADD COLUMN IF NOT EXISTS task_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS diary_entries_open_tasks_due_idx
  ON public.diary_entries (business_id, task_due_date)
  WHERE entry_type = 'task' AND task_completed = false;
