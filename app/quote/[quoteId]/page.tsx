import Image from "next/image";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PublicQuoteActions } from "@/components/quotes/public-quote-actions";
import { formatScopeNumber, toQuoteContentBlocks } from "@/lib/quotes/readableQuote";
import { resolveQuotePricingMode } from "@/lib/quotes/pricingMode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePublicQuoteAccess } from "@/lib/public-quote";
import type { QuoteOption, QuoteRecord } from "@/lib/types";

type Props = {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ fixture?: string; token?: string }>;
};

export default async function PublicQuotePage({ params, searchParams }: Props) {
  const { quoteId } = await params;
  const { fixture, token } = await searchParams;
  const previewRecord = quoteId === "qa-preview" && process.env.VERCEL_ENV === "preview" ? getPreviewQuoteFixture(fixture) : null;
  const supabase = previewRecord ? null : createSupabaseAdminClient();
  const { data: quote } = supabase
    ? await supabase.from("quotes").select("*").eq("id", quoteId).single()
    : { data: previewRecord };
  if (!quote) notFound();

  const record = quote as QuoteRecord;
  const access = previewRecord ? { ok: true as const, mode: "token" as const } : validatePublicQuoteAccess(record, token);
  if (!access.ok) notFound();

  const options = (record.options ?? []) as QuoteOption[];
  const [roofPlan, recipient] = previewRecord
    ? [null, { customerName: "Customer Preview", propertyAddress: "14 Sample Close, London, AB1 2CD" }] as const
    : await Promise.all([
        access.mode === "token" ? getInlineRoofPlanHref(supabase!, record.id) : Promise.resolve(null),
        getQuoteRecipient(supabase!, record.job_id)
      ]);

  return (
    <main className="min-h-screen scroll-smooth bg-[#eee9de] px-0 py-0 text-[#242321] sm:px-4 sm:py-6 md:px-6 md:py-10" data-no-theme="true">
      <div className="mx-auto max-w-[900px]">
        <div className="overflow-hidden bg-[#f8f5ee] shadow-[0_24px_70px_rgba(35,31,23,0.18)] sm:rounded-[1.5rem] sm:border sm:border-[#d8d1c2]">
          <header className="bg-[#171714] px-5 py-7 text-white sm:px-7 md:px-10 md:py-10">
            <p className="font-ui text-[0.72rem] font-extrabold uppercase tracking-[0.22em] text-[#d4af37]">We Are Roofing UK Ltd</p>
            <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div>
                <h1 className="font-display text-[2.65rem] font-extrabold uppercase leading-[0.98] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">Quotation</h1>
                <p className="mt-4 max-w-xl font-ui text-[17px] leading-7 text-[#d7d3ca]">
                  A clear report of our findings, the work included and your complete quoted price.
                </p>
              </div>
              <div className="md:text-right">
                {recipient?.customerName ? <p className="font-ui text-sm font-bold text-white">Prepared for {recipient.customerName}</p> : null}
                {recipient?.propertyAddress ? <p className="mt-1 max-w-sm font-ui text-sm leading-6 text-[#c4bfb5]">{recipient.propertyAddress}</p> : null}
                <div className="mt-3 inline-flex rounded-full border border-[#d4af37]/45 bg-[#d4af37]/10 px-3 py-1.5 font-ui text-xs font-extrabold text-[#ead16c]">
                  Quote reference&nbsp; {record.quote_ref}
                </div>
              </div>
            </div>
          </header>

          <nav aria-label="Quotation contents" className="border-b border-[#ddd6c9] bg-[#fffdf8] px-4 py-4 sm:px-7 md:px-10">
            <ol className="grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-4">
              <QuoteStepLink href="#roof-report" label="Roof report" step="01" />
              <QuoteStepLink href="#scope-of-works" label="Scope of works" step="02" />
              <QuoteStepLink href="#pricing" label="Your quotation" step="03" />
              <QuoteStepLink href="#accept-quote" label="Your decision" step="04" />
            </ol>
          </nav>

          <div className="grid gap-5 p-3 sm:p-5 md:gap-7 md:p-8 lg:p-10">
            <QuoteSection id="roof-report" step="01" title="Roof Report" intro="What we found during our inspection">
              <ReadableText value={record.roof_report} />
            </QuoteSection>

            <QuoteSection id="scope-of-works" step="02" title="Scope of Works" intro="The work included in this quotation">
              <ReadableText numberHeadings value={record.scope_of_works} />
            </QuoteSection>

            {roofPlan ? (
              <QuoteSection title="Your Roof Plan" intro="The lettered sections on this plan match the pricing sections below.">
                {roofPlan.mimeType?.startsWith("image/") || roofPlan.mimeType === "image/svg+xml" ? (
                  <div className="overflow-hidden rounded-xl border border-[#ddd6c9] bg-white">
                    <Image alt="Customer roof plan with lettered quote sections" className="h-auto w-full" height={900} src={roofPlan.href} unoptimized width={1400} />
                  </div>
                ) : (
                  <a
                    className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#d4af37] px-5 py-3 font-ui text-base font-extrabold text-black transition hover:bg-[#e2c557]"
                    href={roofPlan.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View roof plan
                  </a>
                )}
                <p className="font-ui text-[17px] leading-7 text-[#555149]">
                  Prices stay in the quote section, so this drawing stays clean and easy to follow.
                </p>
              </QuoteSection>
            ) : null}

            <PublicQuoteActions
              costBreakdown={record.cost_breakdown ?? []}
              options={options}
              pricingMode={resolveQuotePricingMode(record.customer_pricing_mode, options.length)}
              quoteId={record.id}
              token={previewRecord ? "qa-preview" : access.mode === "token" ? token : null}
            />
          </div>
        </div>

        <details className="mx-3 mt-5 rounded-xl border border-[#d8d1c2] bg-[#fffdf8] p-5 shadow-sm open:border-[#b8960c] sm:mx-0 md:p-7">
          <summary className="cursor-pointer font-ui text-sm font-extrabold uppercase tracking-[0.08em] text-[#6d5407] marker:text-[#b8960c]">
            Guarantee, exclusions and terms
          </summary>
          <div className="mt-5 grid gap-5">
            {record.guarantee_text ? (
              <QuoteSection title="Guarantee">
                <ReadableText value={record.guarantee_text} />
              </QuoteSection>
            ) : null}

            {record.exclusions ? (
              <QuoteSection title="Exclusions">
                <ReadableText value={record.exclusions} />
              </QuoteSection>
            ) : null}

            {record.terms ? (
              <QuoteSection title="Terms">
                <ReadableText value={record.terms} />
              </QuoteSection>
            ) : null}
          </div>
        </details>
      </div>
    </main>
  );
}

async function getInlineRoofPlanHref(supabase: ReturnType<typeof createSupabaseAdminClient>, quoteId: string) {
  const { data: attachment } = await supabase
    .from("quote_attachments")
    .select("job_documents(id, display_name, storage_bucket, storage_path, mime_type)")
    .eq("quote_id", quoteId)
    .eq("attachment_type", "inline_quote_roof_plan")
    .limit(1)
    .maybeSingle();

  const document = Array.isArray(attachment?.job_documents) ? attachment?.job_documents[0] : attachment?.job_documents;
  if (!document?.storage_bucket || !document.storage_path) return null;

  const signed = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60 * 60);
  const href = signed.data?.signedUrl;
  return href ? { href, displayName: document.display_name ?? "Customer roof plan", mimeType: document.mime_type ?? null } : null;
}

async function getQuoteRecipient(supabase: ReturnType<typeof createSupabaseAdminClient>, jobId: string) {
  const { data: job } = await supabase
    .from("jobs")
    .select("customer_id, property_address, postcode")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return null;

  const { data: customer } = job.customer_id
    ? await supabase.from("customers").select("full_name").eq("id", job.customer_id).maybeSingle()
    : { data: null };
  const address = [job.property_address, job.postcode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

  return {
    customerName: customer?.full_name?.trim() || null,
    propertyAddress: address || null
  };
}

function QuoteStepLink({ href, label, step }: { href: string; label: string; step: string }) {
  return (
    <li>
      <a className="group flex min-h-11 items-center gap-2 border-b border-transparent px-1 py-2 font-ui text-[0.7rem] font-extrabold uppercase tracking-[0.05em] text-[#34312c] transition hover:border-[#d4af37] hover:text-black" href={href}>
        <span className="shrink-0 text-xs font-black text-[#92740e]">{step}</span>
        <span>{label}</span>
      </a>
    </li>
  );
}

function QuoteSection({ children, id, intro, step, title }: { children: ReactNode; id?: string; intro?: string; step?: string; title: string }) {
  return (
    <section className="scroll-mt-4 rounded-xl border border-[#ded8cc] bg-[#fffdf9] p-5 shadow-[0_8px_26px_rgba(48,41,27,0.05)] sm:p-6 md:p-8" id={id}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
        {step ? <span className="pt-1 font-ui text-xs font-black tracking-[0.12em] text-[#92740e]">{step}</span> : null}
        <div className={step ? "" : "col-span-2"}>
          <h2 className="font-display text-[1.8rem] font-extrabold uppercase leading-[1.05] tracking-[-0.035em] text-[#23221f] sm:text-3xl md:text-4xl">{title}</h2>
          {intro ? <p className="mt-2 max-w-3xl font-ui text-[0.7rem] font-extrabold uppercase leading-5 tracking-[0.13em] text-[#766a4a]">{intro}</p> : null}
        </div>
      </div>
      <div className="mt-6 max-w-[76ch] space-y-5">{children}</div>
    </section>
  );
}

function ReadableText({ value, compact = false, numberHeadings = false }: { value?: string | null; compact?: boolean; numberHeadings?: boolean }) {
  const blocks = toQuoteContentBlocks(value);
  if (!blocks.length) {
    return <p className={compact ? "font-ui text-base leading-7 text-[#625d54]" : "font-ui text-[17px] leading-7 text-[#514d46]"}>To be confirmed.</p>;
  }

  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const showNumber = block.numbered || (numberHeadings && !block.emphasis);
          const headingIndex = blocks.slice(0, index + 1).filter((item) => item.kind === "heading" && (item.numbered || (numberHeadings && !item.emphasis))).length - 1;
          const heading = (
            <h3 className={`min-w-0 break-words font-display font-extrabold uppercase tracking-[-0.015em] text-[#292722] ${block.emphasis ? "text-base leading-6 md:text-lg" : "text-xl leading-7 md:text-[1.35rem]"}`}>
              {block.text}
            </h3>
          );

          return showNumber ? (
            <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-2.5 border-l-2 border-[#d4af37] pl-3 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-3 sm:pl-4" key={`heading-${index}`}>
              <span className="pt-0.5 font-ui text-sm font-black tabular-nums text-[#8a6a08]">{formatScopeNumber(headingIndex)}</span>
              {heading}
            </div>
          ) : (
            <div className="border-l-2 border-[#d4af37] pl-3 sm:pl-4" key={`heading-${index}`}>{heading}</div>
          );
        }

        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List className="divide-y divide-[#e5dfd3]" key={`list-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li className="flex items-start gap-3 py-3 font-ui text-[17px] leading-[1.65] text-[#403d37] md:text-[18px]" key={`${item}-${itemIndex}`}>
                  <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center text-xs font-black text-[#8a6a08]">
                    {block.ordered ? String(itemIndex + 1).padStart(2, "0") : "✓"}
                  </span>
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </List>
          );
        }

        return (
          <p className={compact ? "font-ui text-sm leading-7 text-[#4f4b44] md:text-base" : "font-ui text-[17px] leading-[1.65] text-[#45413a] md:text-[18px]"} key={`p-${index}`}>
            {block.text}
          </p>
        );
      })}
    </>
  );
}

function getPreviewQuoteFixture(fixture = "pmma"): QuoteRecord {
  const tiledScope = `1 Roof Cleaning & Moss Treatment
- Carefully remove moss and organic growth from all accessible roof slopes.
- Clear gutters and outlets on completion.

1 Valley Repairs
- Lift the adjacent tiles and inspect the valley support.
- Renew defective valley details and reinstate the roof covering.

3 Hip & Ridge Repairs
- Remove loose mortar and prepare the existing ridge line.
- Re-bed and mechanically fix all suitable ridge tiles.`;
  const optionScope = `1 Roof Cleaning & Moss Treatment
Manually scrape and remove moss, silt and accumulated organic debris from the tiled roof covering.

1 Valley Repairs
Clear all affected valley channels and renew failed mortar where required.

1 Hips & Ridges
Remove loose mortar and re-bed suitable hip and ridge tiles.

1 Box Gutter
Clean and repair the box gutter details included in the quotation.

1 Tile Replacement
Replace the identified defective roof tiles with suitable matching tiles.

New Fascia, Soffit & Guttering Carefully remove the existing guttering, fascia and soffit from the agreed elevations.

ASBESTOS WARNING
Existing fascia and soffit materials are assumed to be non-asbestos-containing unless otherwise identified. If suspected asbestos-containing materials are discovered, work to the affected area will stop and additional testing or removal charges may apply.

1 Access
Works are priced on the basis of suitable ladder access and aluminium access towers where required. No fixed scaffolding is currently included.`;
  const pmmaScope = `01 —FLAT ROOF — APPROX. 14 M²
- Existing paving slabs to be lifted and removed by site/others prior to our works.
- Inspect the exposed waterproofing, substrate, falls and perimeter details.
- Mechanically prepare all suitable surfaces.

02—SILTEC SILFLEX PMMA WATERPROOFING SYSTEM
- Install a fully reinforced Siltec RB30 PMMA waterproofing system to the prepared roof area.
- Dress all perimeter, outlet and threshold details in accordance with the manufacturer’s specification.

03 — EXTERNAL STAIRCASE
- Prepare the staircase and landings for the specified reinforced PMMA system.
- Protect adjacent finishes throughout the works.`;
  const optionLines = [
    { item: "Moss Scrape roof works", notes: "Roof cleaning and moss treatment.", cost: 1495, vat_applicable: true, pricing_category: "roof_works", quote_section: "Moss Scrape" },
    { item: "Box Gutter roof works", notes: "Box gutter cleaning and repairs.", cost: 1295, vat_applicable: true, pricing_category: "roof_works", quote_section: "Box Gutter" },
    { item: "Valleys roof works", notes: "Valley repairs.", cost: 850, vat_applicable: true, pricing_category: "roof_works", quote_section: "Valleys" },
    { item: "Hips & Ridges roof works", notes: "Hip and ridge repairs.", cost: 720, vat_applicable: true, pricing_category: "roof_works", quote_section: "Hips & Ridges" },
    { item: "Tile Replacement roof works", notes: "Replacement of identified defective tiles.", cost: 180, vat_applicable: true, pricing_category: "roof_works", quote_section: "Tile Replacement" },
    { item: "Complete White uPVC Fascia, Soffit & Gutter Replacement Including Eaves Protection roof works", display_name: "White uPVC Fascia, Soffit & Guttering with Eaves Protection", notes: "Complete fascia, soffit and guttering package.", cost: 3595, vat_applicable: true, pricing_category: "roof_works", quote_section: "Fascia, Soffit & Guttering" }
  ];
  const baseLines = fixture === "options"
    ? optionLines
    : fixture === "tiled"
    ? [
        { item: "Roof cleaning and moss treatment", notes: "Complete preparation, cleaning and responsible disposal.", cost: 2450, vat_applicable: true },
        { item: "Valley, hip and ridge repairs", notes: "Repair works described in the scope above.", cost: 3975, vat_applicable: true }
      ]
    : [
        { item: "Siltec Silflex PMMA Waterproofing System", notes: "Flat roof preparation and fully reinforced waterproofing system.", cost: 5559, vat_applicable: true },
        { item: "External Staircase PMMA System", notes: "Preparation and reinforced waterproofing to the staircase and landings.", cost: 5959, vat_applicable: true }
      ];
  const subtotal = baseLines.reduce((sum, line) => sum + line.cost, 0);
  const vatAmount = subtotal * 0.2;
  const options: QuoteOption[] = fixture === "options"
    ? [
        { id: "option-a", label: "Option A", title: "Complete Roof Remedial Works", short_description: "Complete remedial roof package", description: "The complete roof remedial works described in this quotation.", cost_breakdown: baseLines.slice(0, 5), subtotal: 4540, vat_amount: 908, total: 5448, recommended: false },
        { id: "option-b", label: "Option B", title: "Complete Roof Works + New Fascia, Soffit & Guttering", short_description: "Roof works plus the complete fascia package", description: "The complete roof works together with new fascia, soffit and guttering.", cost_breakdown: baseLines, subtotal, vat_amount: vatAmount, total: subtotal + vatAmount, recommended: true }
      ]
    : [];

  return {
    id: "qa-preview",
    job_id: "qa-preview-job",
    quote_ref: fixture === "tiled" ? "WR-Q-1028" : fixture === "options" ? "WR-Q-OPTIONS" : "WR-Q-PMMA",
    version_number: 1,
    roof_report: fixture === "tiled" || fixture === "options"
      ? "The tiled roof has a significant build-up of moss, with localised defects visible at the valleys, hips and ridge line. The covering remains suitable for a targeted repair programme, subject to the conditions set out below."
      : "The existing flat roof and external staircase were inspected for their general condition, falls, perimeter detailing and suitability for a reinforced liquid-applied waterproofing system. Local preparation will be required before installation.",
    scope_of_works: fixture === "options" ? optionScope : fixture === "tiled" ? tiledScope : pmmaScope,
    cost_breakdown: baseLines,
    subtotal,
    vat_amount: vatAmount,
    total: subtotal + vatAmount,
    customer_pricing_mode: fixture === "options" ? "options" : "single",
    options,
    guarantee_text: "The installed waterproofing system is covered by the applicable manufacturer and workmanship guarantees set out in the final contract documentation.",
    exclusions: "Scaffolding alterations requested after commencement and concealed substrate repairs are excluded unless separately agreed in writing.",
    terms: "This quotation remains subject to the stated terms, site access and final confirmation of the programme.",
    status: "Sent",
    public_token: "qa-preview",
    missing_info: [],
    pricing_notes: []
  };
}
