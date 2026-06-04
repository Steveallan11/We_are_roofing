-- Add reminder support to diary entries
-- reminder_time: when the reminder should alert
-- reminder_completed: user marked as done/snoozed

ALTER TABLE public.diary_entries
  ADD COLUMN IF NOT EXISTS reminder_time timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_completed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS diary_entries_reminder_due_idx
  ON public.diary_entries (reminder_time, reminder_completed)
  WHERE reminder_time IS NOT NULL AND reminder_completed = false AND entry_type = 'reminder';
