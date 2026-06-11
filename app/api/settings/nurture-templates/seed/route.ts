import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_TEMPLATES = [
  {
    day_number: 3,
    template_name: "follow_up_3days",
    subject: "Checking in on your quote – Any questions?",
    body: `Hi {customer_name},

I hope you've had a chance to review the quote for {job_title}.

If you have any questions or need clarification on anything, I'm here to help. Just give me a call or reply to this email.

Looking forward to working with you!

Best regards,
Andy @ We Are Roofing`
  },
  {
    day_number: 7,
    template_name: "follow_up_7days",
    subject: "Following up on your {job_title} quote",
    body: `Hi {customer_name},

Following up on the quote we sent a few days ago for {job_title}.

Would love to get this moving forward. Let me know if you'd like to proceed or if there's anything I can help clarify.

Thanks!
Andy`
  },
  {
    day_number: 14,
    template_name: "follow_up_14days",
    subject: "Last reminder: Your roof quote is still valid",
    body: `Hi {customer_name},

Just a friendly reminder that the quote for {job_title} is still valid and available.

If you're ready to move forward or have any final questions, I'm happy to help. Otherwise, feel free to reach out if your timeline changes and you'd like to revisit the project.

Best regards,
Andy @ We Are Roofing`
  }
];

export async function POST() {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: businesses } = await supabase.from("businesses").select("id").limit(1);
    const businessId = businesses?.[0]?.id;

    if (!businessId) {
      return Response.json({ error: "No business found" }, { status: 404 });
    }

    const inserts = DEFAULT_TEMPLATES.map((t) => ({
      business_id: businessId,
      ...t
    }));

    const { data, error } = await supabase
      .from("nurture_templates")
      .upsert(inserts, { onConflict: "business_id,day_number", ignoreDuplicates: true })
      .select("*");

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, templates: data, count: data?.length || 0 });
  } catch (error) {
    console.error("Error seeding nurture templates:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
