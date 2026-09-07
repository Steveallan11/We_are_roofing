import { notFound } from "next/navigation";
import { PublicVariationActions } from "@/components/variations/PublicVariationActions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JobVariationRecord } from "@/lib/types";
import { currency } from "@/lib/utils";
import { verifyVariationPublicToken } from "@/lib/variations/publicLink";

type Props = {
  params: Promise<{ variationId: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function PublicVariationPage({ params, searchParams }: Props) {
  const { variationId } = await params;
  const { token } = await searchParams;
  const supabase = createSupabaseAdminClient();
  const lookup = await supabase.from("job_variations").select("*").eq("id", variationId).single();
  if (lookup.error || !lookup.data) notFound();
  const variation = lookup.data as JobVariationRecord;
  if (!verifyVariationPublicToken(variation.public_token, token)) notFound();

  const { data: job } = await supabase.from("jobs").select("job_ref,job_title,property_address").eq("id", variation.job_id).single();
  if (!job) notFound();
  const canRespond = variation.status === "Sent";

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-6 md:py-10">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] border border-[#3b3527] bg-[#151515] shadow-2xl">
        <header className="border-b border-[#3b3527] bg-black/35 px-5 py-8 md:px-9 md:py-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#D4AF37]">We Are Roofing UK Ltd</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-white md:text-6xl">Additional Work</h1>
          <p className="mt-3 font-ui text-base leading-7 text-[#cfcfcf]">{variation.variation_ref} · {job.job_ref}</p>
        </header>

        <div className="grid gap-5 p-5 md:p-8">
          <section className="rounded-3xl border border-[#3b3527] bg-black/25 p-5 md:p-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#D4AF37]">Proposed variation</p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-white md:text-4xl">{variation.title}</h2>
            <p className="mt-3 font-ui text-base leading-7 text-[#d2d2d2]">{variation.description || "Additional work identified during the job."}</p>
            <div className="mt-5 rounded-2xl border border-[#3b3527] bg-[#1c1a16] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a8a8a8]">Property</p>
              <p className="mt-2 font-ui text-base leading-7 text-white">{job.property_address}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-[#3b3527] bg-black/25 p-5 md:p-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#D4AF37]">Price breakdown</p>
            <div className="mt-5 divide-y divide-[#3b3527]">
              {variation.line_items.map((item) => (
                <div className="grid grid-cols-[1fr_auto] gap-4 py-4" key={item.id}>
                  <div>
                    <p className="font-ui text-base font-bold text-white">{item.description}</p>
                    <p className="mt-1 text-sm text-[#aaa]">{item.quantity} {item.unit} at {currency(item.unit_price)}{item.vat_applicable ? " + VAT" : ""}</p>
                  </div>
                  <p className="font-ui text-base font-bold text-white">{currency(item.total)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-3 border-t border-[#796b40] pt-5">
              <PriceRow label="Subtotal" value={variation.subtotal} />
              <PriceRow label="VAT" value={variation.vat_amount} />
              <div className="flex items-end justify-between gap-4 border-t border-[#796b40] pt-4">
                <span className="font-ui text-lg font-extrabold text-white">Total including VAT</span>
                <span className="font-display text-3xl text-[#D4AF37]">{currency(variation.total)}</span>
              </div>
            </div>
          </section>

          {canRespond ? <PublicVariationActions token={token!} variationId={variation.id} /> : (
            <div className="rounded-3xl border border-[#3b3527] bg-black/25 p-6 text-center">
              <p className="font-display text-3xl text-white">Response recorded</p>
              <p className="mt-3 font-ui text-base text-[#cfcfcf]">This additional work is currently marked {variation.status.toLowerCase()}.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function PriceRow({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between gap-4 font-ui text-base text-[#d8d8d8]"><span>{label}</span><strong className="text-white">{currency(value)}</strong></div>;
}
