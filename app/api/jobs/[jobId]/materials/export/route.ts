import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canPersistToSupabase } from "@/lib/workflows";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, { params }: Props) {
  const { jobId } = await params;
  const searchParams = new URL(request.url).searchParams;
  const includePrices = searchParams.get("include_prices") === "true";
  const preview = searchParams.get("preview") === "true";

  if (!canPersistToSupabase()) {
    return csvResponse(buildCsv({ job: null, customer: null, materials: [], includePrices }), "materials-list.csv", preview);
  }

  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, job_ref, job_title, property_address, customer_id, customers(full_name, email, phone)")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) {
    return NextResponse.json({ ok: false, error: jobError?.message ?? "Job not found." }, { status: 404 });
  }

  const { data: materials, error: materialError } = await supabase
    .from("materials")
    .select("*")
    .eq("job_id", jobId)
    .order("category", { ascending: true })
    .order("item_name", { ascending: true });

  if (materialError) {
    return NextResponse.json({ ok: false, error: materialError.message }, { status: 500 });
  }

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const filename = `${safeFilename(job.job_ref || job.job_title || "job")}-${includePrices ? "materials-internal-estimates" : "material-pricing-request"}.csv`;
  return csvResponse(buildCsv({ job, customer, materials: materials ?? [], includePrices }), filename, preview);
}

function buildCsv({
  job,
  customer,
  materials,
  includePrices
}: {
  job: any;
  customer: any;
  materials: any[];
  includePrices: boolean;
}) {
  const header = [
    "Item",
    "Category",
    "Quantity",
    "Unit",
    "Required status",
    "Preferred supplier",
    "Notes / specification",
    ...(includePrices ? ["Our estimated unit cost", "Our estimated total"] : []),
    "Supplier unit price",
    "Supplier total",
    "Availability",
    "Lead time",
    "Supplier notes"
  ];
  const rows: string[][] = [
    ["We Are Roofing UK Ltd - Material Pricing Request"],
    ["Job ref", job?.job_ref || ""],
    ["Job", job?.job_title || ""],
    ["Property", job?.property_address || ""],
    ["Customer", customer?.full_name || ""],
    ["Generated", new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date())],
    ["Internal estimates included", includePrices ? "Yes" : "No - supplier copy"],
    [],
    header
  ];

  for (const material of materials) {
    rows.push([
      material.item_name || "",
      material.category || "",
      String(material.quantity ?? ""),
      material.unit || "",
      material.required_status || "",
      material.supplier || "",
      material.notes || "",
      ...(includePrices ? [formatMoney(material.unit_cost ?? material.estimated_price ?? ""), formatMoney(material.total_cost ?? "")] : []),
      "",
      "",
      "",
      "",
      ""
    ]);
  }

  if (materials.length === 0) {
    rows.push(Array.from({ length: header.length }, (_, index) => (index === 0 ? "No materials added yet" : "")));
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatMoney(value: number | string | null) {
  if (value === "" || value == null) return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "";
}

function csvResponse(csv: string, filename: string, preview: boolean) {
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function safeFilename(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "job";
}
