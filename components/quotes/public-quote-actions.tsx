"use client";

import { useState } from "react";
import type { CostLineItem, QuoteOption } from "@/lib/types";
import { buildQuoteOptionCustomerRows, calculateOptionNet, calculateOptionVat, getOptionTotal, getQuoteOptionPresentation } from "@/lib/quotes/value";
import { currency } from "@/lib/utils";

type Props = {
  quoteId: string;
  costBreakdown?: CostLineItem[];
  options: QuoteOption[];
  token?: string | null;
};

export function PublicQuoteActions({ costBreakdown = [], quoteId, options, token }: Props) {
  const sectionChoices = buildSectionChoices(costBreakdown);
  const useSectionSelection = shouldUseSectionSelection(sectionChoices, options);
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    useSectionSelection ? null : options.find((option) => option.recommended)?.id ?? options[0]?.id ?? null
  );
  const [selectedLineIndexes, setSelectedLineIndexes] = useState<number[]>(() => sectionChoices.flatMap((section) => section.indexes));
  const [status, setStatus] = useState<string | null>(null);
  const selectedOption = useSectionSelection ? null : options.find((option) => option.id === selectedOptionId) ?? options[0] ?? null;
  const hasSelection = useSectionSelection ? selectedLineIndexes.length > 0 : options.length ? Boolean(selectedOptionId) : selectedLineIndexes.length > 0 || sectionChoices.length === 0;
  const hasName = customerName.trim().length >= 2;
  const hasValidEmail = /^\S+@\S+\.\S+$/.test(customerEmail.trim());
  const acceptanceHelper = getAcceptanceHelper({ hasName, hasSelectedOption: hasSelection, hasValidEmail });

  if (!token) {
    return (
      <div className="mt-8 rounded-[1.5rem] border border-[var(--gold)]/35 bg-[var(--surface)] p-5 shadow-2xl md:p-7">
        <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">Read-only quote link</p>
        <h2 className="mt-3 font-display text-3xl text-white md:text-4xl">Ask Andy for the secure quote link</h2>
        <p className="mt-3 font-ui text-base leading-7 text-[var(--text-muted)]">
          This older quote link is available for viewing only. To accept the quote or send a question through the portal, use the latest secure link from your email.
        </p>
      </div>
    );
  }
  const secureToken = token;
  const canAccept = hasName && hasValidEmail && hasSelection;

  async function accept() {
    if (!canAccept) {
      setStatus("Please add your name and email before accepting, so we can record who confirmed the quote.");
      return;
    }

    const response = await fetch(`/api/quotes/${quoteId}/accept?token=${encodeURIComponent(secureToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        option_id: useSectionSelection ? null : selectedOptionId,
        selected_line_indexes: useSectionSelection ? selectedLineIndexes : [],
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim()
      })
    });
    setStatus(response.ok ? "Quote accepted. We Are Roofing will be in touch shortly." : "Sorry, acceptance could not be recorded.");
  }

  async function sendMessage() {
    if (!message.trim()) return;
    const response = await fetch(`/api/quotes/${quoteId}/message?token=${encodeURIComponent(secureToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_name: customerName, sender_email: customerEmail, message })
    });
    setStatus(response.ok ? "Message sent to We Are Roofing." : "Sorry, message could not be sent.");
    if (response.ok) setMessage("");
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-[1.5rem] border border-[var(--gold)]/35 bg-[#f8f3e3] p-5 shadow-2xl md:p-7">
        <p className="font-ui text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#8a6a08]">{useSectionSelection ? "Choose your roof sections" : "Choose your preferred option"}</p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-[#1f1f1f] md:text-5xl">{useSectionSelection ? "Choose the sections you want done" : "Choose the option that suits you best"}</h2>
        <p className="mt-3 font-ui text-base leading-7 text-[#4a4a4a] md:text-lg md:leading-8">
          {useSectionSelection
            ? "Select the roof sections you would like us to carry out now. Each section shows the roof works price and any scaffold/access cost separately."
            : "Below are your two quote options. Option B is our recommended choice if you want the best weather protection during the works."}
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2" aria-label="Quote options">
        {useSectionSelection ? (
          <SectionChoiceList
            sections={sectionChoices}
            selectedLineIndexes={selectedLineIndexes}
            setSelectedLineIndexes={setSelectedLineIndexes}
          />
        ) : options.length ? (
          options.map((option, index) => {
            const meta = getQuoteOptionPresentation(option, index);
            const isSelected = selectedOptionId === option.id;
            const netRows = buildQuoteOptionCustomerRows(option);
            const netTotal = calculateOptionNet(option);

            return (
            <button
              className={`relative min-h-56 rounded-[1.4rem] border-2 p-5 text-left transition ${
                isSelected
                  ? "border-[var(--gold)] bg-[var(--gold)] text-black shadow-[0_0_0_4px_rgba(212,175,55,0.16)]"
                  : "border-[var(--border)] bg-[#101010] text-[#f2f2f2] hover:border-[var(--gold)]/50"
              }`}
              key={option.id}
              onClick={() => setSelectedOptionId(option.id)}
              type="button"
            >
              <span className="flex h-full flex-col justify-between gap-5">
                <span className="space-y-2">
                  <span className={`block font-ui text-xs font-bold uppercase tracking-[0.18em] ${isSelected ? "text-black/70" : "text-[var(--gold)]"}`}>
                    {meta.optionName}
                  </span>
                  <span className="block font-display text-2xl leading-tight">{meta.title}</span>
                  <span className={`block font-ui text-sm leading-6 ${isSelected ? "text-black/70" : "text-[#cfcfcf]"}`}>{meta.shortDescription}</span>
                </span>
                <span className="block space-y-2">
                  {netRows.map((row) => (
                    <OptionCardPriceRow isSelected={isSelected} key={row.id} label={row.label} value={row.net} />
                  ))}
                  <span className={`block border-t pt-3 ${isSelected ? "border-black/20" : "border-white/10"}`}>
                    <OptionCardPriceRow isSelected={isSelected} label="Total before VAT" strong value={netTotal} />
                  </span>
                </span>
                <span className="flex justify-end">
                  <span className={`rounded-full px-3 py-1.5 font-ui text-xs font-bold ${isSelected ? "bg-black text-[var(--gold)]" : "bg-[var(--gold)]/12 text-[var(--gold)]"}`}>
                    {isSelected ? "Selected" : "Tap to select"}
                  </span>
                </span>
                {option.recommended ? (
                  <span className={`absolute right-4 top-4 rounded-full px-3 py-1 font-ui text-[0.65rem] font-bold uppercase tracking-[0.12em] ${isSelected ? "bg-black/10 text-black" : "bg-[var(--gold)] text-black"}`}>
                    Recommended
                  </span>
                ) : null}
              </span>
            </button>
          );
          })
        ) : sectionChoices.length ? (
          <SectionChoiceList
            sections={sectionChoices}
            selectedLineIndexes={selectedLineIndexes}
            setSelectedLineIndexes={setSelectedLineIndexes}
          />
        ) : (
          <p className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-4 font-ui text-base text-[var(--text-second)]">
            Ready to proceed? Confirm your details, then accept below.
          </p>
        )}
      </section>

      {selectedOption ? <SelectedOptionDetail option={selectedOption} selectedIndex={options.findIndex((option) => option.id === selectedOption.id)} /> : null}

      <section className="rounded-[1.5rem] border border-[var(--gold)]/35 bg-[#f8f3e3] p-5 shadow-2xl md:p-7">
        <p className="font-ui text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#8a6a08]">Ready to accept this quote?</p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-[#1f1f1f] md:text-4xl">Ready to go ahead?</h2>
        <p className="mt-3 font-ui text-base leading-7 text-[#4a4a4a]">
          Enter your details below and we&apos;ll confirm your selection and next steps.
        </p>
        <p className="mt-2 font-ui text-sm leading-6 text-[#6a6a6a]">
          We&apos;ll use these details to confirm your selection and contact you about the next stage.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input className="field min-h-12" onChange={(event) => setCustomerName(event.target.value)} placeholder="Full name" autoComplete="name" value={customerName} />
          <input className="field min-h-12" onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Email address" type="email" inputMode="email" autoComplete="email" value={customerEmail} />
        </div>
        <p className={`mt-4 font-ui text-sm font-semibold ${canAccept ? "text-[#166534]" : "text-[#8a4b00]"}`}>{acceptanceHelper}</p>
        <button
          className="mt-4 min-h-14 w-full rounded-xl bg-[var(--gold)] px-5 py-3 font-ui text-base font-extrabold text-black shadow-[0_10px_28px_rgba(212,175,55,0.28)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[#d6caa0] disabled:text-[#6a6248] disabled:shadow-none"
          disabled={!canAccept}
          onClick={accept}
          type="button"
        >
          Accept This Quote
        </button>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-[#101010] p-5 md:p-7">
        <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">Have a question?</p>
        <p className="mt-3 font-ui text-base leading-7 text-[#d6d6d6]">If anything is unclear, send Andy a message before accepting.</p>
        <textarea className="field mt-5 min-h-36 text-base leading-7" onChange={(event) => setMessage(event.target.value)} placeholder="Type your question here..." value={message} />
        <button className="button-ghost mt-3 !min-h-12 !text-base" onClick={sendMessage} type="button">
          Send Question
        </button>
      </section>

      {status ? <p className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-4 font-ui text-sm text-[var(--gold-l)]">{status}</p> : null}
    </div>
  );
}

type SectionChoice = {
  name: string;
  indexes: number[];
  lines: Array<CostLineItem & { originalIndex: number }>;
  net: number;
  vat: number;
  total: number;
};

function SectionChoiceList({
  sections,
  selectedLineIndexes,
  setSelectedLineIndexes
}: {
  sections: SectionChoice[];
  selectedLineIndexes: number[];
  setSelectedLineIndexes: (indexes: number[]) => void;
}) {
  function toggleSection(section: SectionChoice) {
    const selected = section.indexes.every((index) => selectedLineIndexes.includes(index));
    if (selected) {
      setSelectedLineIndexes(selectedLineIndexes.filter((index) => !section.indexes.includes(index)));
      return;
    }
    setSelectedLineIndexes([...new Set([...selectedLineIndexes, ...section.indexes])]);
  }

  const selectedSections = sections.filter((section) => section.indexes.every((index) => selectedLineIndexes.includes(index)));
  const selectedNet = selectedSections.reduce((sum, section) => sum + section.net, 0);
  const selectedVat = selectedSections.reduce((sum, section) => sum + section.vat, 0);

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="rounded-2xl border border-[var(--gold)]/30 bg-[#101010] p-4">
        <p className="font-ui text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Select the sections you want done</p>
        <p className="mt-2 font-ui text-sm leading-6 text-[#d6d6d6]">
          Each section includes its own roof works and scaffold/access price. You can accept all sections or only the areas you want to proceed with now.
        </p>
      </div>
      {sections.map((section) => {
        const selected = section.indexes.every((index) => selectedLineIndexes.includes(index));
        const packageSummary = getSectionPackageSummary(section);
        return (
          <button
            className={`w-full rounded-[1.25rem] border-2 p-4 text-left transition ${
              selected ? "border-[var(--gold)] bg-[var(--gold)] text-black" : "border-[var(--border)] bg-[#101010] text-white hover:border-[var(--gold)]/50"
            }`}
            key={section.name}
            onClick={() => toggleSection(section)}
            type="button"
          >
            <span className="flex items-start justify-between gap-4">
              <span>
                <span className={`block font-display text-2xl ${selected ? "text-black" : "text-white"}`}>{section.name}</span>
                <span className={`mt-1 block font-ui text-sm ${selected ? "text-black/70" : "text-[#cfcfcf]"}`}>{packageSummary.description}</span>
              </span>
              <span className={`rounded-full px-3 py-1.5 font-ui text-xs font-bold ${selected ? "bg-black text-[var(--gold)]" : "bg-[var(--gold)]/12 text-[var(--gold)]"}`}>
                {selected ? "Selected" : "Tap to select"}
              </span>
            </span>
            <span className={`mt-4 block border-t pt-3 ${selected ? "border-black/20" : "border-white/10"}`}>
              <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
                <span>
                  <span className={`block font-ui text-base font-extrabold ${selected ? "text-black" : "text-white"}`}>{section.name} roof works + scaffold/access</span>
                  <span className={`mt-1 block font-ui text-xs leading-5 ${selected ? "text-black/65" : "text-[#cfcfcf]"}`}>
                    Includes roof works {currency(packageSummary.roofNet)}{packageSummary.accessNet > 0 ? ` + scaffold/access ${currency(packageSummary.accessNet)}` : ""}{section.vat > 0 ? ` + VAT ${currency(section.vat)}` : ""}
                  </span>
                </span>
                <span className={`shrink-0 text-right font-display text-3xl font-bold ${selected ? "text-black" : "text-[var(--gold-l)]"}`}>{currency(section.total)}</span>
              </span>
            </span>
          </button>
        );
      })}
      <div className="rounded-2xl border border-[var(--gold)]/30 bg-[#17130a] p-4 font-ui">
        <div className="flex items-center justify-between gap-4 text-sm text-[#d6d6d6]">
          <span>Selected sections before VAT</span>
          <strong className="text-white">{currency(selectedNet)}</strong>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4 text-sm text-[#d6d6d6]">
          <span>VAT</span>
          <strong className="text-white">{currency(selectedVat)}</strong>
        </div>
        <div className="mt-3 flex items-end justify-between gap-4 border-t border-[var(--gold)]/35 pt-3">
          <span className="text-base font-bold text-white">Total selected</span>
          <strong className="font-display text-3xl text-[var(--gold-l)]">{currency(selectedNet + selectedVat)}</strong>
        </div>
      </div>
    </div>
  );
}

function OptionCardPriceRow({ isSelected, label, strong = false, value }: { isSelected: boolean; label: string; strong?: boolean; value: number }) {
  return (
    <span className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 font-ui text-sm ${strong ? "font-extrabold" : "font-semibold"}`}>
      <span className={`min-w-0 leading-5 ${isSelected ? "text-black/80" : "text-[#e5e5e5]"}`}>{label}</span>
      <span className={`shrink-0 text-right ${isSelected ? "text-black" : "text-white"}`}>{currency(value)}</span>
    </span>
  );
}

function buildSectionChoices(lines: CostLineItem[]): SectionChoice[] {
  const groups = new Map<string, SectionChoice>();

  lines.forEach((line, originalIndex) => {
    if (Number(line.cost || 0) <= 0) return;
    const name = line.quote_section?.trim() || line.source_label?.trim() || line.item || "Quote section";
    const existing =
      groups.get(name) ??
      ({
        name,
        indexes: [],
        lines: [],
        net: 0,
        vat: 0,
        total: 0
      } satisfies SectionChoice);
    const net = Number(line.cost || 0);
    const vat = line.vat_applicable ? Math.round(net * 0.2 * 100) / 100 : 0;
    existing.indexes.push(originalIndex);
    existing.lines.push({ ...line, originalIndex });
    existing.net += net;
    existing.vat += vat;
    existing.total += net + vat;
    groups.set(name, existing);
  });

  return [...groups.values()]
    .map((section) => ({ ...section, lines: sortSectionLines(section.lines) }))
    .sort((left, right) => Math.min(...left.indexes) - Math.min(...right.indexes));
}

function getLineDisplayLabel(line: CostLineItem) {
  const identity = `${line.item ?? ""} ${line.pricing_category ?? ""} ${line.notes ?? ""}`.toLowerCase();
  if (identity.includes("scaffold") || identity.includes("access")) return "Scaffold/access";
  if (identity.includes("temporary roof") || identity.includes("weather protection")) return "Temporary roof protection";
  return "Roof works";
}

function getSectionPackageSummary(section: SectionChoice) {
  const roofNet = section.lines.filter((line) => lineSortOrder(line) === 1).reduce((sum, line) => sum + Number(line.cost || 0), 0);
  const accessNet = section.lines.filter((line) => lineSortOrder(line) > 1).reduce((sum, line) => sum + Number(line.cost || 0), 0);
  const hasRoof = roofNet > 0;
  const hasAccess = accessNet > 0;
  const description = hasRoof && hasAccess ? "Roof works and scaffold/access combined for this section" : hasAccess ? "Scaffold/access for this section" : "Roof works for this section";

  return {
    roofNet: Math.round(roofNet * 100) / 100,
    accessNet: Math.round(accessNet * 100) / 100,
    description
  };
}

function shouldUseSectionSelection(sections: SectionChoice[], options: QuoteOption[]) {
  if (!sections.length) return false;
  const hasTakeoffLinkedSections = sections.some((section) =>
    section.lines.some((line) => Boolean(line.quote_section || line.source_label || line.measurement_label || line.source_id || line.source_type))
  );
  return hasTakeoffLinkedSections && (sections.length > 1 || options.length > 0);
}

function sortSectionLines(lines: Array<CostLineItem & { originalIndex: number }>) {
  return [...lines].sort((left, right) => lineSortOrder(left) - lineSortOrder(right) || left.originalIndex - right.originalIndex);
}

function lineSortOrder(line: CostLineItem) {
  const identity = `${line.item ?? ""} ${line.pricing_category ?? ""} ${line.notes ?? ""}`.toLowerCase();
  if (identity.includes("scaffold") || identity.includes("access")) return 2;
  if (identity.includes("temporary roof") || identity.includes("weather protection")) return 3;
  return 1;
}

function SelectedOptionDetail({ option, selectedIndex }: { option: QuoteOption; selectedIndex: number }) {
  const meta = getQuoteOptionPresentation(option, selectedIndex);

  return (
    <section className="rounded-[1.5rem] border border-[var(--gold)]/35 bg-[#101010] p-5 shadow-2xl md:p-7">
      <p className="section-kicker text-[0.68rem] uppercase text-[var(--gold)]">Selected option</p>
      <h2 className="mt-2 font-display text-3xl leading-tight text-white md:text-4xl">
        {meta.optionName}: {meta.title}
      </h2>
      <p className="mt-4 max-w-3xl font-ui text-base leading-7 text-[#d6d6d6] md:text-lg md:leading-8">{meta.longDescription}</p>
      <SimplePriceSummary option={option} />
    </section>
  );
}

function SimplePriceSummary({ option }: { option: QuoteOption }) {
  const priceRows = buildQuoteOptionCustomerRows(option);
  const fallbackSubtotal = Math.max(0, Number(option.subtotal || 0));
  const fallbackVat = Math.max(0, Number(option.vat_amount || 0));
  const vat = calculateOptionVat(option) || fallbackVat;
  const total = getOptionTotal(option) ?? fallbackSubtotal + fallbackVat;

  return (
    <div className="mt-5 rounded-2xl border border-[var(--gold)]/30 bg-[#17130a] p-4 md:p-5">
      <p className="font-ui text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Price summary</p>
      <div className="mt-4 space-y-3 font-ui text-sm text-[#f2f2f2] md:text-base">
        {priceRows.length > 0 ? (
          <>
            {priceRows.map((row) => <PriceRow key={row.id} label={row.label} value={row.net} />)}
            <PriceRow label="VAT" muted value={vat} />
          </>
        ) : (
          <>
            <PriceRow label="Works subtotal" value={fallbackSubtotal} />
            <PriceRow label="VAT" muted value={fallbackVat} />
          </>
        )}
        <div className="mt-4 flex items-end justify-between gap-4 border-t border-[var(--gold)]/35 pt-4">
          <span className="font-ui text-base font-bold text-white">Total inc VAT</span>
          <strong className="shrink-0 text-right font-display text-3xl text-[var(--gold-l)]">{currency(total)}</strong>
        </div>
      </div>
    </div>
  );
}

function PriceRow({ label, muted = false, value }: { label: string; muted?: boolean; value: number }) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 ${muted ? "text-[#a9a9a9]" : "text-[#f4f4f4]"}`}>
      <span className="min-w-0 leading-6">{label}</span>
      <strong className="shrink-0 text-right text-white">{currency(value)}</strong>
    </div>
  );
}

function getAcceptanceHelper({ hasName, hasSelectedOption, hasValidEmail }: { hasName: boolean; hasSelectedOption: boolean; hasValidEmail: boolean }) {
  if (!hasSelectedOption) return "Please select an option.";
  if (!hasName && !hasValidEmail) return "Enter your name and email to accept this quote.";
  if (!hasName) return "Please enter your full name.";
  if (!hasValidEmail) return "Please enter a valid email address.";
  return "You're ready to accept this quote.";
}
