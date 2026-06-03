-- Job activity audit log
-- Records every meaningful event on a job so the Activity tab is a true audit trail,
-- not synthesized from existing fields. Wired by lib/activity/createActivity.ts.

CREATE TABLE IF NOT EXISTS public.job_activity (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_id             uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id        uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  quote_id           uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_id         uuid REFERENCES public.invoices(id) ON DELETE SET NULL,

  activity_type      text NOT NULL,
  message            text NOT NULL,
  details            jsonb NOT NULL DEFAULT '{}'::jsonb,

  actor_type         text NOT NULL DEFAULT 'system'
                     CHECK (actor_type IN ('user','customer','system','gauge')),
  actor_id           uuid,
  actor_name         text,

  linked_entity_type text,
  linked_entity_id   uuid,

  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_activity_job_created_idx
  ON public.job_activity (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS job_activity_customer_created_idx
  ON public.job_activity (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS job_activity_business_created_idx
  ON public.job_activity (business_id, created_at DESC);

ALTER TABLE public.job_activity ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_activity' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.job_activity FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
