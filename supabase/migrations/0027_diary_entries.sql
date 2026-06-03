-- Diary entries: capture anywhere, auto-link to jobs/customers/suppliers, feeds to accountant
-- Supports: voice notes, text notes, photos, tasks, reminders, expenses, payments

CREATE TABLE IF NOT EXISTS public.diary_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id               uuid,
  entry_type            text NOT NULL CHECK (entry_type IN ('voice_note','text_note','photo','reminder','task','expense','payment')),

  title                 text,
  body                  text,

  voice_url             text,
  voice_transcript      text,
  voice_transcript_by   text DEFAULT 'user' CHECK (voice_transcript_by IN ('user','gauge','system')),

  photos                jsonb NOT NULL DEFAULT '[]'::jsonb,

  linked_job_id         uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  linked_customer_id    uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  linked_supplier_id    uuid,

  task_due_date         date,
  task_completed        boolean NOT NULL DEFAULT false,
  task_assigned_to      text DEFAULT 'Andy',

  expense_amount        numeric(10,2),
  expense_category      text CHECK (expense_category IN ('materials','labour','subcontractor','fuel','travel','other')),
  expense_receipt_url   text,

  payment_amount        numeric(10,2),
  payment_to_name       text,
  payment_method        text CHECK (payment_method IN ('cash','transfer','card','other')),

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diary_entries_business_created_idx
  ON public.diary_entries (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS diary_entries_job_idx
  ON public.diary_entries (linked_job_id) WHERE linked_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS diary_entries_customer_idx
  ON public.diary_entries (linked_customer_id) WHERE linked_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS diary_entries_task_due_idx
  ON public.diary_entries (task_due_date) WHERE entry_type = 'task' AND task_completed = false;

ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'diary_entries' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.diary_entries FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
