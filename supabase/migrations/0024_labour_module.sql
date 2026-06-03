-- Labour estimating module
-- Adds reusable labour rates, job-level labour plans, and itemised labour entries.

CREATE TABLE IF NOT EXISTS public.labour_rates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  role_name          text NOT NULL,
  cost_rate          numeric(12,2) NOT NULL DEFAULT 0,
  charge_rate        numeric(12,2) NOT NULL DEFAULT 0,
  unit               text NOT NULL DEFAULT 'day' CHECK (unit IN ('hour','day')),
  default_margin_pct numeric(8,2),
  active             boolean NOT NULL DEFAULT true,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS labour_rates_business_role_unit_idx
  ON public.labour_rates (business_id, role_name, unit);

ALTER TABLE public.labour_rates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'labour_rates' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.labour_rates FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.labour_people (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name          text NOT NULL,
  worker_type        text NOT NULL DEFAULT 'staff' CHECK (worker_type IN ('staff','subcontractor','agency','other')),
  primary_role       text,
  phone              text,
  email              text,
  company_name       text,
  day_rate_cost      numeric(12,2),
  day_rate_charge    numeric(12,2),
  hourly_rate_cost   numeric(12,2),
  hourly_rate_charge numeric(12,2),
  skills             text[] DEFAULT '{}',
  emergency_contact  text,
  insurance_notes    text,
  is_active          boolean NOT NULL DEFAULT true,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labour_people_business_id_idx ON public.labour_people (business_id);

ALTER TABLE public.labour_people ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'labour_people' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.labour_people FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.labour_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  quote_id        uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  business_id     uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  title           text DEFAULT 'Labour Plan',
  status          text DEFAULT 'estimated' CHECK (status IN ('estimated','booked','in_progress','completed')),
  crew_confirmed  boolean DEFAULT false,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labour_plans_job_id_idx ON public.labour_plans (job_id);

ALTER TABLE public.labour_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'labour_plans' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.labour_plans FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.labour_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid REFERENCES public.labour_plans(id) ON DELETE CASCADE,
  job_id          uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  labour_rate_id  uuid REFERENCES public.labour_rates(id) ON DELETE SET NULL,
  person_id       uuid REFERENCES public.labour_people(id) ON DELETE SET NULL,
  role_name       text NOT NULL,
  people          numeric(8,2) NOT NULL DEFAULT 1,
  duration        numeric(8,2) NOT NULL DEFAULT 1,
  unit            text NOT NULL DEFAULT 'day' CHECK (unit IN ('hour','day')),
  cost_rate       numeric(12,2) NOT NULL DEFAULT 0,
  charge_rate     numeric(12,2) NOT NULL DEFAULT 0,
  estimated_cost  numeric(12,2) NOT NULL DEFAULT 0,
  charge_total    numeric(12,2) NOT NULL DEFAULT 0,
  actual_duration numeric(8,2),
  actual_cost     numeric(12,2),
  notes           text,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labour_entries_plan_id_idx ON public.labour_entries (plan_id);
CREATE INDEX IF NOT EXISTS labour_entries_job_id_idx ON public.labour_entries (job_id);

ALTER TABLE public.labour_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'labour_entries' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.labour_entries FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

INSERT INTO public.labour_rates (business_id, role_name, cost_rate, charge_rate, unit, default_margin_pct, active, notes)
VALUES
  ('6f9a6dca-a747-4a20-ab87-111808577cc7', 'Roofer', 220, 320, 'day', 31.25, true, 'Standard experienced roofer day rate.'),
  ('6f9a6dca-a747-4a20-ab87-111808577cc7', 'Labourer', 150, 240, 'day', 37.50, true, 'General labour and site support.'),
  ('6f9a6dca-a747-4a20-ab87-111808577cc7', 'Foreman / Lead Roofer', 260, 380, 'day', 31.58, true, 'Lead roofer or site supervisor.'),
  ('6f9a6dca-a747-4a20-ab87-111808577cc7', 'Survey / Admin', 40, 65, 'hour', 38.46, true, 'Survey, admin, and office time.'),
  ('6f9a6dca-a747-4a20-ab87-111808577cc7', 'Subcontractor', 250, 350, 'day', 28.57, true, 'Allowance for specialist subcontract labour.')
ON CONFLICT (business_id, role_name, unit) DO NOTHING;

INSERT INTO public.labour_people (business_id, full_name, worker_type, primary_role, day_rate_cost, day_rate_charge, skills, is_active, notes)
VALUES
  ('6f9a6dca-a747-4a20-ab87-111808577cc7', 'Andy', 'staff', 'Survey / Admin', 0, 0, ARRAY['survey','quote review','customer communication'], true, 'Business owner / lead contact.'),
  ('6f9a6dca-a747-4a20-ab87-111808577cc7', 'Roofer TBC', 'staff', 'Roofer', 220, 320, ARRAY['roofing'], true, 'Placeholder crew profile. Replace with real roofer details.'),
  ('6f9a6dca-a747-4a20-ab87-111808577cc7', 'Labourer TBC', 'staff', 'Labourer', 150, 240, ARRAY['labouring','site support'], true, 'Placeholder labourer profile. Replace with real person details.')
ON CONFLICT DO NOTHING;
