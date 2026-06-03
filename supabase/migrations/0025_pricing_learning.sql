-- Pricing learning support.
-- Keep this additive: live projects may already have some of these columns from earlier migrations.

ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS learned_from_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_observed_rate numeric(12,2),
  ADD COLUMN IF NOT EXISTS last_observed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.pricing_rule_observations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  pricing_rule_id uuid REFERENCES public.pricing_rules(id) ON DELETE SET NULL,
  quote_id        uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  job_id          uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  material_id     uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  source_type     text NOT NULL DEFAULT 'quote',
  item_name       text NOT NULL,
  rule_type       text,
  unit            text,
  quantity        numeric,
  observed_rate   numeric(12,2),
  observed_total  numeric(12,2),
  existing_rate   numeric(12,2),
  discrepancy_pct numeric(8,2),
  action_taken    text NOT NULL DEFAULT 'observed',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.pricing_rule_observations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pricing_rule_observations' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.pricing_rule_observations FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
