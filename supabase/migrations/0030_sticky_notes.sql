-- Sticky notes: visual draggable cards on the diary board
-- Free-form notes with position, size, color. Can optionally link to a job.

CREATE TABLE IF NOT EXISTS public.sticky_notes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id           uuid,

  content           text NOT NULL DEFAULT '',
  color             text NOT NULL DEFAULT '#fde68a',

  position_x        integer NOT NULL DEFAULT 0,
  position_y        integer NOT NULL DEFAULT 0,
  width             integer NOT NULL DEFAULT 220,
  height            integer NOT NULL DEFAULT 220,
  z_index           integer NOT NULL DEFAULT 1,

  linked_job_id     uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  linked_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,

  is_archived       boolean NOT NULL DEFAULT false,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sticky_notes_business_idx
  ON public.sticky_notes (business_id, is_archived, updated_at DESC);

CREATE INDEX IF NOT EXISTS sticky_notes_job_idx
  ON public.sticky_notes (linked_job_id) WHERE linked_job_id IS NOT NULL;

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sticky_notes' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.sticky_notes FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
