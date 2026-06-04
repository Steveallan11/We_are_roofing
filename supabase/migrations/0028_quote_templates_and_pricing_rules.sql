-- Add global quote defaults to business table
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS
  guarantee_text text DEFAULT 'All work is carried out to industry standard and is guaranteed for 10 years from the date of completion.';

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS
  default_exclusions text DEFAULT 'This quotation does not include: decorative gutters or leadwork unless specifically listed; removal of asbestos or hazardous materials; structural repairs to fascia, soffit, or timber; internal redecoration; any items not specifically listed above.';

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS
  default_terms text DEFAULT 'This quotation is valid for 30 days from the date of issue. A deposit of 25% is required to secure the booking. Final payment is due upon completion of works.';

-- Create quote templates table for roof-type specific boilerplate
CREATE TABLE IF NOT EXISTS public.quote_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  roof_type text NOT NULL,
  job_type text,
  template_name text NOT NULL,
  roof_report_template text,
  scope_of_works_template text,
  guarantee_override text,
  exclusions_override text,
  terms_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, roof_type, template_name)
);

CREATE INDEX IF NOT EXISTS quote_templates_business_roof_type_idx
  ON public.quote_templates (business_id, roof_type);

-- Create quote pricing bounds table for min/max validation
-- (Separate from pricing_rules which is used by the rate card system)
CREATE TABLE IF NOT EXISTS public.quote_pricing_bounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  item_category text NOT NULL,
  roof_type text,
  job_type text,
  minimum_price numeric(10,2),
  maximum_price numeric(10,2),
  unit_type text DEFAULT 'total',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_pricing_bounds_business_category_idx
  ON public.quote_pricing_bounds (business_id, item_category);

-- Create knowledge base examples table for AI training
CREATE TABLE IF NOT EXISTS public.knowledge_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  example_type text NOT NULL CHECK (example_type IN ('roof_report', 'scope_of_works', 'guarantee', 'exclusions', 'terms', 'email_subject', 'email_body')),
  roof_type text,
  job_type text,
  title text NOT NULL,
  content text NOT NULL,
  quality_score integer DEFAULT 3,
  uses_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_examples_business_type_idx
  ON public.knowledge_examples (business_id, example_type);

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_pricing_bounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_examples ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quote_templates' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.quote_templates FOR ALL USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quote_pricing_bounds' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.quote_pricing_bounds FOR ALL USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'knowledge_examples' AND policyname = 'Admin access'
  ) THEN
    CREATE POLICY "Admin access" ON public.knowledge_examples FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
