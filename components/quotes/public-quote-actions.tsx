"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { CostLineItem, QuoteOption, QuotePricingMode } from "@/lib/types";
import { buildQuoteOptionCustomerRows, buildQuoteOptionDetailRows, calculateOptionNet, calculateOptionVat, getOptionTotal, getQuoteOptionPresentation } from "@/lib/quotes/value";
import { isPriceToBeConfirmed } from "@/lib/quotes/provisional";
import { currency } from "@/lib/utils";

type Props = {
  quoteId: string;
  costBreakdown?: CostLineItem[];
  options: QuoteOption[];
  pricingMode: QuotePricingMode;
  token?: string | null;
};

export function PublicQuoteActions({ costBreakdown = [], pricingMode, quoteId, options, token }: Props) {
  const pricedLines = costBreakdown.flatMap((line, index) => (Number(line.cost || 0) > 0 ? [{ ...line, originalIndex: index }] : []));
  const hasOptionSelection = pricingMode === "options";
  const useLineSelection = pricingMode === "selectable_items";
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    hasOptionSelection ? options.find((option) => option.recommended)?.id ?? options[0]?.id ?? null : null
  );
  const [selectedLineIndexes, setSelectedLineIndexes] = useState<number[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const selectedOption = hasOptionSelection ? options.find((option) => option.id === selectedOptionId) ?? options[0] ?? null : null;
  const hasSelection = useLineSelection ? selectedLineIndexes.length > 0 : hasOptionSelection ? Boolean(selectedOptionId) : pricedLines.length > 0;
  const hasName = customerName.trim().length >= 2;
  const hasValidEmail = /^\S+@\S+\.\S+$/.test(customerEmail.trim());
  const acceptanceHelper = getAcceptanceHelper({ hasName, hasSelectedOption: hasSelection, hasValidEmail });

  if (!token) {
    return (
      <div className="mt-8 rounded-xl border border-[#d8d1c2] bg-[#fffdf8] p-5 shadow-sm md:p-7">
        <p className="font-ui text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-[#8a6a08]">Read-only quote link</p>
        <h2 className="mt-3 font-display text-3xl font-extrabold uppercase text-[#24221e] md:text-4xl">Ask Andy for the secure quote link</h2>
        <p className="mt-3 font-ui text-[17px] leading-7 text-[#514d46]">
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
        option_id: hasOptionSelection ? selectedOptionId : null,
        selected_line_indexes: useLineSelection ? selectedLineIndexes : [],
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

  async function downloadPDF() {
    setIsDownloading(true);
    try {
      const url = `/api/quotes/${quoteId}/public-pdf?token=${encodeURIComponent(secureToken)}`;
      window.location.href = url;
    } catch (error) {
      console.error("Download error:", error);
      setStatus("Sorry, the PDF download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="scroll-mt-4 space-y-5" id="pricing">
      <section className="rounded-xl border border-[#ded8cc] bg-[#fffdf9] p-5 shadow-[0_8px_26px_rgba(48,41,27,0.05)] sm:p-6 md:p-8">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
          <span className="pt-1 font-ui text-xs font-black tracking-[0.12em] text-[#92740e]">03</span>
          <div>
            <h2 className="font-display text-[1.8rem] font-extrabold uppercase leading-[1.05] tracking-[-0.035em] text-[#23221f] sm:text-3xl md:text-4xl">Your Quotation</h2>
            <p className="mt-2 font-ui text-[0.7rem] font-extrabold uppercase leading-5 tracking-[0.13em] text-[#766a4a]">Price for the works described above</p>
            <p className="mt-4 max-w-3xl font-ui text-[17px] leading-[1.65] text-[#4a4741]">
              {hasOptionSelection
                ? "Compare the two complete alternatives below, then select one option."
                : useLineSelection
                  ? "Tick each item you would like to proceed with. Your price, VAT and total update immediately."
                  : "This is a single quotation for the complete scope of works described above."}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2" aria-label="Quote pricing">
        {hasOptionSelection && options.length ? (
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
        ) : hasOptionSelection ? (
          <p className="rounded-2xl border border-[#b42318]/30 bg-[#fff1f0] p-4 font-ui text-base text-[#7a271a] md:col-span-2">
            The quote options are still being prepared. Please contact us before accepting.
          </p>
        ) : useLineSelection ? (
          <SelectableWorksList lines={pricedLines} selectedLineIndexes={selectedLineIndexes} setSelectedLineIndexes={setSelectedLineIndexes} />
        ) : pricedLines.length ? (
          <SingleQuoteSummary lines={costBreakdown} />
        ) : (
          <p className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-4 font-ui text-base text-[var(--text-second)]">
            Ready to proceed? Confirm your details, then accept below.
          </p>
        )}
      </section>

      {hasOptionSelection && selectedOption ? <SelectedOptionDetail option={selectedOption} selectedIndex={options.findIndex((option) => option.id === selectedOption.id)} /> : null}

      <section className="scroll-mt-4 rounded-xl border border-[#ded8cc] bg-[#fffdf9] p-5 shadow-[0_8px_26px_rgba(48,41,27,0.05)] sm:p-6 md:p-8" id="accept-quote">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
          <span className="pt-1 font-ui text-xs font-black tracking-[0.12em] text-[#92740e]">04</span>
          <div>
            <h2 className="font-display text-[1.8rem] font-extrabold uppercase leading-[1.05] tracking-[-0.035em] text-[#23221f] sm:text-3xl md:text-4xl">Your Decision</h2>
            <p className="mt-2 font-ui text-[0.7rem] font-extrabold uppercase leading-5 tracking-[0.13em] text-[#766a4a]">Accept the quotation or ask us a question</p>
            <p className="mt-4 max-w-3xl font-ui text-[17px] leading-[1.65] text-[#4a4741]">
              When you are happy with the report, scope and price, enter your details to accept securely. Nothing is submitted until you press the acceptance button.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="font-ui text-sm font-bold text-[#333]">
            Full name
            <input className="field mt-2 min-h-12" onChange={(event) => setCustomerName(event.target.value)} placeholder="Enter your full name" autoComplete="name" value={customerName} />
          </label>
          <label className="font-ui text-sm font-bold text-[#333]">
            Email address
            <input className="field mt-2 min-h-12" onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Enter your email address" type="email" inputMode="email" autoComplete="email" value={customerEmail} />
          </label>
        </div>
        <p className={`mt-4 font-ui text-sm font-semibold ${canAccept ? "text-[#166534]" : "text-[#8a4b00]"}`}>{acceptanceHelper}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            className="min-h-14 w-full rounded-xl bg-[var(--gold)] px-5 py-3 font-ui text-base font-extrabold text-black shadow-[0_10px_28px_rgba(212,175,55,0.28)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[#d6caa0] disabled:text-[#6a6248] disabled:shadow-none"
            disabled={!canAccept}
            onClick={accept}
            type="button"
          >
            Accept This Quote
          </button>
          <button
            className="min-h-14 w-full rounded-xl border-2 border-[var(--gold)] bg-transparent px-5 py-3 font-ui text-base font-extrabold text-[var(--gold)] transition hover:bg-[var(--gold)]/10 disabled:cursor-not-allowed disabled:border-[#d6caa0] disabled:text-[#6a6248]"
            disabled={isDownloading}
            onClick={downloadPDF}
            type="button"
          >
            {isDownloading ? "Downloading..." : "Download PDF"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[#342f23] bg-[#171714] p-5 md:p-7">
        <p className="font-ui text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-[#d4af37]">Have a question?</p>
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
                    {packageSummary.directAccessNet > 0 ? (
                      <span className={`mt-1 block font-bold uppercase tracking-[0.06em] ${selected ? "text-black/70" : "text-[var(--gold)]"}`}>
                        + {currency(packageSummary.directAccessNet)} scaffold/access, paid direct to the scaffold company — not in this price
                      </span>
                    ) : null}
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
    const name = getCustomerSectionName(line);
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
    if (!line.billed_separately) {
      existing.net += net;
      existing.vat += vat;
      existing.total += net + vat;
    }
    groups.set(name, existing);
  });

  return [...groups.values()]
    .map((section) => ({ ...section, lines: sortSectionLines(section.lines) }))
    .sort((left, right) => Math.min(...left.indexes) - Math.min(...right.indexes));
}

function getCustomerSectionName(line: CostLineItem) {
  const candidates = [line.quote_section, line.source_label];
  const customerName = candidates.find((candidate) => candidate?.trim() && !isInternalSectionName(candidate));
  return customerName?.trim() || "Quoted works";
}

function isInternalSectionName(value: string) {
  const normalised = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return [
    "roof works",
    "access",
    "scaffold",
    "scaffold access",
    "standard scaffold",
    "temporary roof protection",
    "temporary roof weather protection",
    "additional works",
    "general works"
  ].includes(normalised);
}

function getOptionalLineIndexes(lines: CostLineItem[]) {
  return lines.flatMap((line, index) => (isOptionalQuoteLine(line) && Number(line.cost || 0) > 0 ? [index] : []));
}

function isOptionalQuoteLine(line: CostLineItem) {
  const identity = `${line.item ?? ""} ${line.notes ?? ""} ${line.pricing_category ?? ""}`.toLowerCase();
  return identity.includes("insulation") || identity.includes("optional extra") || identity.includes("optional upgrade");
}

function getCustomerLineLabel(line: CostLineItem) {
  const item = line.item?.trim();
  if (item && !isInternalSectionName(item)) return item;
  return getLineDisplayLabel(line);
}

function getLineDisplayLabel(line: CostLineItem) {
  const category = (line.pricing_category ?? "").toLowerCase();
  if (category === "roof_works") return "Roof works";
  if (category === "temporary_roof_protection") return "Temporary roof protection";
  if (category === "standard_scaffold" || category === "access") return "Scaffold/access";
  const identity = `${line.item ?? ""} ${line.pricing_category ?? ""} ${line.notes ?? ""}`.toLowerCase();
  if (identity.includes("scaffold") || identity.includes("access")) return "Scaffold/access";
  if (identity.includes("temporary roof") || identity.includes("weather protection")) return "Temporary roof protection";
  return "Roof works";
}

function getSectionPackageSummary(section: SectionChoice) {
  const accessLines = section.lines.filter((line) => lineSortOrder(line) > 1);
  const roofNet = section.lines.filter((line) => lineSortOrder(line) === 1).reduce((sum, line) => sum + Number(line.cost || 0), 0);
  const accessNet = accessLines.filter((line) => !line.billed_separately).reduce((sum, line) => sum + Number(line.cost || 0), 0);
  const directAccessNet = accessLines.filter((line) => line.billed_separately).reduce((sum, line) => sum + Number(line.cost || 0), 0);
  const hasRoof = roofNet > 0;
  const hasAccess = accessNet > 0;
  const hasDirectAccess = directAccessNet > 0;
  const description = hasRoof && hasAccess ? "Roof works and scaffold/access combined for this section" : hasAccess ? "Scaffold/access for this section" : "Roof works for this section";

  return {
    roofNet: Math.round(roofNet * 100) / 100,
    accessNet: Math.round(accessNet * 100) / 100,
    directAccessNet: Math.round(directAccessNet * 100) / 100,
    description
  };
}

function shouldUseSectionSelection(sections: SectionChoice[], options: QuoteOption[]) {
  if (options.length > 1 || sections.length <= 1) return false;
  return sections.every((section) => section.name !== "Quoted works");
}

function SingleQuoteSummary({ lines }: { lines: CostLineItem[] }) {
  const pricedLines = lines.map((line, index) => ({ ...line, originalIndex: index })).filter((line) => Number(line.cost || 0) > 0);
  const billableLines = pricedLines.filter((line) => !line.billed_separately);
  const directLines = pricedLines.filter((line) => line.billed_separately);
  const net = roundMoney(billableLines.reduce((sum, line) => sum + Number(line.cost || 0), 0));
  const vat = roundMoney(billableLines.reduce((sum, line) => sum + getLineVat(line), 0));

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="rounded-xl border border-[#6f5b1e] bg-[#10100f] p-5 md:p-7">
        <p className="font-ui text-xs font-extrabold uppercase tracking-[0.18em] text-[#d4af37]">Complete quotation</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
          <h3 className="font-display text-2xl font-extrabold uppercase leading-tight text-white sm:text-3xl">All works included</h3>
          <strong className="break-all font-display text-[2.45rem] leading-none text-[#ead16c] sm:text-5xl">{currency(net + vat)}</strong>
        </div>
        <p className="mt-3 font-ui text-sm leading-6 text-[#cfcfcf]">Total including VAT</p>
        <div className="mt-5 divide-y divide-white/10 border-y border-white/10 font-ui">
          {billableLines.map((line) => (
            <div className="py-4" key={`single-${line.originalIndex}`}>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5">
                <div>
                  <p className="font-bold leading-6 text-white">{getCustomerLineLabel(line)}</p>
                  {line.notes?.trim() ? <p className="mt-1 text-sm leading-6 text-[#bdbdbd]">{line.notes.trim()}</p> : null}
                </div>
                <div className="sm:text-right">
                  <strong className="block text-white">{currency(Number(line.cost || 0))}</strong>
                  <span className="text-xs text-[#a9a9a9]">before VAT</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {directLines.length ? (
        <div className="rounded-xl border border-white/10 bg-[#101010] p-5 md:p-6">
          <p className="font-ui text-xs font-extrabold uppercase tracking-[0.18em] text-[#d4af37]">Paid separately</p>
          <div className="mt-4 space-y-3">
            {directLines.map((line) => <DirectPayRow key={`direct-${line.originalIndex}`} label={getCustomerLineLabel(line)} note={line.billed_separately_note} value={Number(line.cost || 0)} />)}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#6f5b1e] bg-[#17130a] p-4 font-ui md:p-5">
        <div className="flex items-center justify-between gap-4 text-sm text-[#d6d6d6]">
          <span>Price before VAT</span>
          <strong className="text-white">{currency(net)}</strong>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4 text-sm text-[#d6d6d6]">
          <span>VAT</span>
          <strong className="text-white">{currency(vat)}</strong>
        </div>
        <div className="mt-3 flex items-end justify-between gap-4 border-t border-[var(--gold)]/35 pt-3">
          <span className="text-base font-bold text-white">Total including VAT</span>
          <strong className="break-all text-right font-display text-3xl text-[#ead16c]">{currency(net + vat)}</strong>
        </div>
      </div>
    </div>
  );
}

function SelectableWorksList({
  lines,
  selectedLineIndexes,
  setSelectedLineIndexes
}: {
  lines: Array<CostLineItem & { originalIndex: number }>;
  selectedLineIndexes: number[];
  setSelectedLineIndexes: Dispatch<SetStateAction<number[]>>;
}) {
  const selectableLines = lines.filter((line) => !line.billed_separately);
  const directLines = lines.filter((line) => line.billed_separately);
  const selectedLines = selectableLines.filter((line) => selectedLineIndexes.includes(line.originalIndex));
  const net = roundMoney(selectedLines.reduce((sum, line) => sum + Number(line.cost || 0), 0));
  const vat = roundMoney(selectedLines.reduce((sum, line) => sum + getLineVat(line), 0));

  function toggleLine(index: number) {
    setSelectedLineIndexes((current) =>
      current.includes(index) ? current.filter((selectedIndex) => selectedIndex !== index) : [...current, index]
    );
  }

  return (
    <div className="space-y-3 md:col-span-2">
      {selectableLines.map((line) => {
        const selected = selectedLineIndexes.includes(line.originalIndex);
        const gross = roundMoney(Number(line.cost || 0) + getLineVat(line));
        return (
          <button
            aria-pressed={selected}
            className={`w-full rounded-[1.25rem] border-2 p-4 text-left transition md:p-5 ${
              selected ? "border-[var(--gold)] bg-[var(--gold)] text-black" : "border-[var(--border)] bg-[#101010] text-white hover:border-[var(--gold)]/50"
            }`}
            key={`selectable-${line.originalIndex}`}
            onClick={() => toggleLine(line.originalIndex)}
            type="button"
          >
            <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 md:gap-4">
              <span className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border-2 text-sm font-black ${selected ? "border-black bg-black text-[var(--gold)]" : "border-[var(--gold)] text-transparent"}`}>
                ✓
              </span>
              <span className="min-w-0">
                <span className="block font-ui text-base font-extrabold">{getCustomerLineLabel(line)}</span>
                {line.quote_section?.trim() ? <span className={`mt-1 block font-ui text-xs font-bold uppercase tracking-[0.08em] ${selected ? "text-black/60" : "text-[var(--gold)]"}`}>{line.quote_section.trim()}</span> : null}
                {line.notes?.trim() ? <span className={`mt-2 block font-ui text-sm leading-6 ${selected ? "text-black/70" : "text-[#bdbdbd]"}`}>{line.notes.trim()}</span> : null}
              </span>
              <span className="shrink-0 text-right">
                <strong className="block font-display text-2xl">{currency(gross)}</strong>
                <span className={`font-ui text-[0.65rem] font-bold uppercase tracking-[0.1em] ${selected ? "text-black/60" : "text-[#a9a9a9]"}`}>including VAT</span>
              </span>
            </span>
          </button>
        );
      })}

      {!selectableLines.length ? <p className="rounded-2xl border border-white/10 bg-[#101010] p-4 text-[#d6d6d6]">No selectable priced work has been added yet.</p> : null}

      {directLines.length ? (
        <div className="rounded-[1.25rem] border border-white/10 bg-[#101010] p-5">
          <p className="font-ui text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--gold)]">Paid separately and not selectable</p>
          <div className="mt-4 space-y-3">
            {directLines.map((line) => <DirectPayRow key={`select-direct-${line.originalIndex}`} label={getCustomerLineLabel(line)} note={line.billed_separately_note} value={Number(line.cost || 0)} />)}
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-3 rounded-2xl border border-[var(--gold)]/40 bg-[#17130a]/95 p-4 font-ui shadow-2xl backdrop-blur md:p-5">
        <div className="flex items-center justify-between gap-4 text-sm text-[#d6d6d6]"><span>Selected before VAT</span><strong className="text-white">{currency(net)}</strong></div>
        <div className="mt-2 flex items-center justify-between gap-4 text-sm text-[#d6d6d6]"><span>VAT</span><strong className="text-white">{currency(vat)}</strong></div>
        <div className="mt-3 flex items-end justify-between gap-4 border-t border-[var(--gold)]/35 pt-3">
          <span><span className="block text-base font-bold text-white">Your selected total</span><span className="mt-1 block text-xs text-[#a9a9a9]">{selectedLines.length} item{selectedLines.length === 1 ? "" : "s"} selected</span></span>
          <strong className="font-display text-3xl text-[var(--gold-l)]">{currency(net + vat)}</strong>
        </div>
      </div>
    </div>
  );
}

function getLineVat(line: CostLineItem) {
  return line.vat_applicable ? roundMoney(Number(line.cost || 0) * 0.2) : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function CustomerQuoteLine({ line }: { line: CostLineItem }) {
  const isTbc = isPriceToBeConfirmed(line);
  const isDirectPay = Boolean(line.billed_separately);

  return (
    <span className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 font-ui text-sm font-semibold">
      <span className="min-w-0">
        <span className="block leading-5 text-black/80">{getCustomerLineLabel(line)}</span>
        {isTbc ? (
          <span className="mt-1 inline-flex rounded-full bg-black px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-[var(--gold)]">
            Price to be confirmed
          </span>
        ) : null}
        {isDirectPay ? (
          <span className="mt-1 inline-flex rounded-full bg-black px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-[var(--gold)]">
            {line.billed_separately_note?.trim() || "Paid direct to supplier"}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-right text-black">
        {currency(Number(line.cost || 0))}
        {isTbc ? <span className="mt-1 block text-[0.62rem] font-bold uppercase tracking-[0.08em] text-black/55">Current allowance</span> : null}
        {isDirectPay ? <span className="mt-1 block text-[0.62rem] font-bold uppercase tracking-[0.08em] text-black/55">Not in this total</span> : null}
      </span>
    </span>
  );
}

function sortSectionLines(lines: Array<CostLineItem & { originalIndex: number }>) {
  return [...lines].sort((left, right) => lineSortOrder(left) - lineSortOrder(right) || left.originalIndex - right.originalIndex);
}

function lineSortOrder(line: CostLineItem) {
  const category = (line.pricing_category ?? "").toLowerCase();
  if (category === "roof_works") return 1;
  if (category === "standard_scaffold" || category === "access") return 2;
  if (category === "temporary_roof_protection") return 3;
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
  const detailRows = buildQuoteOptionDetailRows(option);
  const chargeableRows = detailRows.filter((row) => !row.billedSeparately);
  const directRows = detailRows.filter((row) => row.billedSeparately);
  const fallbackSubtotal = Math.max(0, Number(option.subtotal || 0));
  const fallbackVat = Math.max(0, Number(option.vat_amount || 0));
  const vat = calculateOptionVat(option) || fallbackVat;
  const total = getOptionTotal(option) ?? fallbackSubtotal + fallbackVat;

  return (
    <div className="mt-5 rounded-2xl border border-[var(--gold)]/30 bg-[#17130a] p-4 md:p-5">
      <p className="font-ui text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Price summary</p>
      <div className="mt-4 space-y-3 font-ui text-sm text-[#f2f2f2] md:text-base">
        {chargeableRows.length > 0 ? (
          <>
            {chargeableRows.map((row) => <PriceRow key={row.id} label={row.label} value={row.net} />)}
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
      {directRows.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-[var(--gold)]/20 pt-4">
          {directRows.map((row) => (
            <DirectPayRow key={row.id} label={row.label} note={row.billedSeparatelyNote} value={row.net} />
          ))}
        </div>
      ) : null}
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

function DirectPayRow({ label, note, value }: { label: string; note?: string; value: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 font-ui text-sm">
      <span className="min-w-0">
        <span className="block leading-6 text-[#d6d6d6]">{label}</span>
        <span className="mt-1 inline-flex rounded-full bg-black px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-[var(--gold)]">
          {note?.trim() || "Paid direct to supplier"}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <strong className="text-[#d6d6d6]">{currency(value)}</strong>
        <span className="mt-1 block text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#8a8a8a]">Not in this total</span>
      </span>
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
