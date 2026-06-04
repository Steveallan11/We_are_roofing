import { AppShell } from "@/components/layout/app-shell";
import { TemplatesWorkspace } from "@/components/settings/templates-workspace";
import { getBusiness } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Quote Templates & Rules" };

async function getTemplatesData(businessId: string) {
  const supabase = createSupabaseAdminClient();

  const [templates, pricingRules, examples] = await Promise.all([
    supabase.from("quote_templates").select("*").eq("business_id", businessId).order("roof_type"),
    supabase.from("pricing_rules").select("*").eq("business_id", businessId).order("item_category"),
    supabase.from("knowledge_examples").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(50)
  ]);

  return {
    templates: (templates.data ?? []) as any[],
    pricingRules: (pricingRules.data ?? []) as any[],
    examples: (examples.data ?? []) as any[]
  };
}

export default async function TemplatesPage() {
  const business = await getBusiness();
  const data = await getTemplatesData(business.id);

  return (
    <AppShell
      title="Quote Templates & Pricing Rules"
      subtitle="Manage quote boilerplate, pricing bounds, and AI knowledge examples to ensure consistency across all quotes."
      wide
    >
      <TemplatesWorkspace business={business} initialTemplates={data.templates} initialRules={data.pricingRules} initialExamples={data.examples} />
    </AppShell>
  );
}
