"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CostLineItem, QuoteOption, QuoteRecord } from "@/lib/types";
import { applyRateCardToCostBreakdown, findRateForItem, type RateCardEntry } from "@/lib/pricing/rateCard";
import {
  buildDefaultQuoteOptionsFromLines,
  buildQuoteOptionPriceSummary,
  calculateOptionNet,
  calculateOptionVat,
  getQuoteLineItemCategory,
  normaliseQuoteCostLine,
  normaliseQuoteOption
} from "@/lib/quotes/value";
import type { RoofSurveyRecord } from "@/lib/survey/types";
import { buildTakeoffDrawingSvg, printDrawing, type DrawingQuoteSection } from "@/lib/survey/cadDrawing";
import { currency } from "@/lib/utils";
import { TakeoffQuotePreview } from "@/components/jobs/takeoff-quote-preview";

type Props = {
  jobId: string;
  quote: QuoteRecord | null;
  rateCard?: RateCardEntry[];
  roofSurvey?: RoofSurveyRecord | null;
};

export function QuoteEditor({ jobId, quote, rateCard = [], roofSurvey = null }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roofReport, setRoofReport] = useState(quote?.roof_report ?? "");
  const [scopeOfWorks, setScopeOfWorks] = useState(quote?.scope_of_works ?? "");
  const [guaranteeText, setGuaranteeText] = useState(quote?.guarantee_text ?? "");
  const [exclusions, setExclusions] = useState(quote?.exclusions ?? "");
  const [terms, setTerms] = useState(quote?.terms ?? "");
  const [emailSubject, setEmailSubject] = useState(quote?.customer_email_subject ?? "");
  const [emailBody, setEmailBody] = useState(quote?.customer_email_body ?? "");
  const [confidence, setConfidence] = useState<QuoteRecord["confidence"]>(quote?.confidence ?? "Medium");
  const [pricingNotes, setPricingNotes] = useState((quote?.pricing_notes ?? []).join("\n"));
  const [missingInfo, setMissingInfo] = useState((quote?.missing_info ?? []).join("\n"));
  const [costBreakdown, setCostBreakdown] = useState<CostLineItem[]>(() => {
    const initial = quote?.cost_breakdown?.length
      ? quote.cost_breakdown
      : [{ item: "Main works", cost: 0, vat_applicable: false, notes: "Draft pricing line item" }];
    return rateCard.length ? applyRateCardToCostBreakdown(initial, rateCard).updated : initial;
  });
  const [options, setOptions] = useState<QuoteOption[]>(() => quote?.options ?? []);
  const [messages, setMessages] = useState<Array<{ id: string; sender_type: string; sender_name?: string | null; message: string; created_at?: string }>>([]);
  const [reply, setReply] = useState("");
  const [selectedTakeoffSourceId, setSelectedTakeoffSourceId] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [buildingWithChatGpt, setBuildingWithChatGpt] = useState(false);
  const [chatGptContext, setChatGptContext] = useState("");
  const [chatGptStyle, setChatGptStyle] = useState(
    "Write in Andy's We Are Roofing style: practical, direct, customer-friendly British English. Start with what was found, explain what needs doing, keep paragraphs clear, avoid hype, and make the quote feel professional and easy to understand."
  );

  useEffect(() => {
    if (!quote?.id) return;
    let active = true;
    fetch(`/api/quotes/${quote.id}/message`)
      .then((response) => response.json())
      .then((result) => {
        if (active && result?.ok) setMessages(result.messages ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [quote?.id]);

  const totals = useMemo(() => {
    const subtotal = Math.round(costBreakdown.reduce((sum, item) => sum + Number(item.cost || 0), 0) * 100) / 100;
    const vat = Math.round(costBreakdown.filter((item) => item.vat_applicable).reduce((sum, item) => sum + Number(item.cost || 0) * 0.2, 0) * 100) / 100;
    return { subtotal, vat, total: subtotal + vat };
  }, [costBreakdown]);
  const unpricedLines = useMemo(
    () => costBreakdown.filter((line) => Number(line.cost || 0) === 0 && !findRateForItem(line.item, rateCard, line.pricing_category)),
    [costBreakdown, rateCard]
  );
  const quoteSections = useMemo(() => groupQuoteSections(costBreakdown), [costBreakdown]);

  if (!quote) {
    return (
      <div className="card p-5">
        <p className="text-sm text-[var(--muted)]">Generate the first quote draft from this job before review editing becomes available.</p>
      </div>
    );
  }

  const currentQuote = quote;
  const quoteId = quote.id;

  function updateLine(index: number, updates: Partial<CostLineItem>) {
    setCostBreakdown((current) => current.map((item, itemIndex) => (itemIndex === index ? normaliseCostLine({ ...item, ...updates }, updates) : item)));
  }

  function deleteLine(index: number) {
    setCostBreakdown((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setSuccess("Line item removed. Save changes to keep this cost breakdown.");
    setError(null);
  }

  function addMainSectionPackage() {
    const sectionName = window.prompt("Section name, e.g. Front elevation, Rear flat roof, Chimney stack");
    if (!sectionName?.trim()) return;
    const cleanSectionName = sectionName.trim();
    const sectionSlug = slugify(cleanSectionName);

    setCostBreakdown((current) => [
      ...current,
      {
        item: "Roof works",
        cost: 0,
        vat_applicable: false,
        notes: "",
        pricing_category: "roof_works",
        quote_section: cleanSectionName,
        source_id: `${sectionSlug}-roof-works`
      },
      {
        item: "Scaffold/access",
        cost: 0,
        vat_applicable: true,
        notes: "Scaffold/access supplier cost. VAT applies where charged by the scaffolder.",
        pricing_category: "standard_scaffold",
        quote_section: cleanSectionName,
        source_id: `${sectionSlug}-scaffold`
      }
    ]);
    setSuccess(`${cleanSectionName} section added with roof works and scaffold/access lines. Save changes when priced.`);
    setError(null);
  }

  function addTakeoffSectionPackages() {
    if (!roofSurvey?.sections.length) {
      setError("No roof drawing sections found yet. Draw and save roof sections in the takeoff tool first.");
      setSuccess(null);
      return;
    }

    setCostBreakdown((current) => {
      const nextLines: CostLineItem[] = [];

      roofSurvey.sections.forEach((section, index) => {
        const sectionName = section.label?.trim() || `Drawing section ${index + 1}`;
        const sectionId = section.id || slugify(sectionName);
        const measurement = section.area_m2 ? `${section.area_m2.toFixed(1)} m2` : "";
        const hasRoofLine = current.some((line) => line.quote_section === sectionName && line.pricing_category === "roof_works");
        const hasScaffoldLine = current.some((line) => line.quote_section === sectionName && line.pricing_category === "standard_scaffold");
        const common = {
          quote_section: sectionName,
          source_id: sectionId,
          source_type: "section",
          source_label: sectionName,
          source_color: section.color,
          measurement_label: measurement,
          takeoff_notes: section.notes || ""
        };

        if (!hasRoofLine) {
          nextLines.push({
            ...common,
            item: "Roof works",
            cost: 0,
            vat_applicable: false,
            notes: [`Drawing section: ${sectionName}`, measurement ? `Measured area: ${measurement}` : null, section.notes ? `Notes: ${section.notes}` : null]
              .filter(Boolean)
              .join("\n"),
            quantity: section.area_m2 ? Number(section.area_m2.toFixed(2)) : undefined,
            unit: section.area_m2 ? "m2" : undefined,
            unit_rate: 0,
            pricing_category: "roof_works"
          });
        }

        if (!hasScaffoldLine) {
          nextLines.push({
            ...common,
            item: "Scaffold/access",
            cost: 0,
            vat_applicable: true,
            notes: [`Scaffold/access for drawing section: ${sectionName}`, "VAT applies where charged by the scaffolder.", section.notes ? `Notes: ${section.notes}` : null].filter(Boolean).join("\n"),
            pricing_category: "standard_scaffold"
          });
        }
      });

      return [...current, ...nextLines];
    });
    setSuccess("Drawing sections added to the quote with roof works and scaffold/access lines.");
    setError(null);
  }

  function addScaffoldLineForTakeoff(index: number) {
    const source = costBreakdown[index];
    if (!source) return;
    const sectionName = source.quote_section || source.source_label || source.item || "Takeoff item";
    const rawPrice = window.prompt(`Scaffold/access net price for ${sectionName} (before VAT)`, "0");
    if (rawPrice === null) return;
    const scaffoldCost = Number(rawPrice || 0);
    const scaffoldLine: CostLineItem = {
      item: "Scaffold/access",
      cost: Number.isFinite(scaffoldCost) ? scaffoldCost : 0,
      vat_applicable: true,
      notes: `Scaffold/access for ${sectionName}. VAT applies where charged by the scaffolder.`,
      pricing_category: "standard_scaffold",
      quote_section: sectionName,
      source_id: source.source_id,
      source_type: source.source_type,
      source_label: source.source_label || sectionName,
      source_color: source.source_color,
      measurement_label: source.measurement_label,
      takeoff_notes: source.takeoff_notes
    };

    setCostBreakdown((current) => [...current.slice(0, index + 1), scaffoldLine, ...current.slice(index + 1)]);
    setSuccess(`Scaffold/access VAT line added for ${sectionName}.`);
    setError(null);
  }

  function calculateOption(lines: CostLineItem[]) {
    const subtotal = calculateOptionNet({ cost_breakdown: lines });
    const vatAmount = calculateOptionVat({ cost_breakdown: lines });
    return { subtotal, vat_amount: vatAmount, total: subtotal + vatAmount };
  }

  function makeOption(index: number, lines = costBreakdown): QuoteOption {
    return buildDefaultQuoteOptionsFromLines(lines)[index] ?? buildDefaultQuoteOptionsFromLines(lines)[0];
  }

  function addOption() {
    setOptions((current) => {
      if (current.length === 0) {
        return buildDefaultQuoteOptionsFromLines(costBreakdown);
      }
      const nextLetter = String.fromCharCode(65 + current.length);
      return [...current, { ...makeOption(0), id: `option-${nextLetter.toLowerCase()}`, label: `Option ${nextLetter}`, recommended: false }];
    });
  }

  function updateOption(optionId: string, updates: Partial<QuoteOption>) {
    setOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) return updates.recommended ? { ...option, recommended: false } : option;
        const next = { ...option, ...updates };
        const totals = calculateOption(next.cost_breakdown);
        return { ...next, ...totals };
      })
    );
  }

  function updateOptionLine(optionId: string, index: number, updates: Partial<CostLineItem>) {
    setOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) return option;
        const cost_breakdown = option.cost_breakdown.map((line, lineIndex) => (lineIndex === index ? normaliseCostLine({ ...line, ...updates }, updates) : line));
        return { ...option, cost_breakdown, ...calculateOption(cost_breakdown) };
      })
    );
  }

  function addOptionLine(optionId: string) {
    setOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) return option;
        const cost_breakdown = [...option.cost_breakdown, { item: "Additional works", cost: 0, vat_applicable: false, notes: "" }];
        return { ...option, cost_breakdown, ...calculateOption(cost_breakdown) };
      })
    );
  }

  function addSectionPackage(optionId: string) {
    const sectionName = window.prompt("Section name, e.g. Front elevation, Rear flat roof, Chimney stack");
    if (!sectionName?.trim()) return;
    const cleanSectionName = sectionName.trim();

    setOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) return option;
        const sectionSlug = slugify(cleanSectionName);
        const cost_breakdown = [
          ...option.cost_breakdown,
          {
            item: "Roof works",
            cost: 0,
            vat_applicable: false,
            notes: "",
            pricing_category: "roof_works",
            quote_section: cleanSectionName,
            source_id: `${sectionSlug}-roof-works`
          },
          {
            item: "Scaffold/access",
            cost: 0,
            vat_applicable: true,
            notes: "Scaffold/access supplier cost. VAT applies where charged by the scaffolder.",
            pricing_category: "standard_scaffold",
            quote_section: cleanSectionName,
            source_id: `${sectionSlug}-scaffold`
          }
        ];
        return { ...option, cost_breakdown, ...calculateOption(cost_breakdown) };
      })
    );
  }

  function deleteOptionLine(optionId: string, index: number) {
    setOptions((current) =>
      current.map((option) => {
        if (option.id !== optionId) return option;
        const cost_breakdown = option.cost_breakdown.filter((_, lineIndex) => lineIndex !== index);
        return { ...option, cost_breakdown, ...calculateOption(cost_breakdown) };
      })
    );
  }

  function deleteOption(optionId: string) {
    setOptions((current) => {
      const next = current.filter((option) => option.id !== optionId);
      if (next.length > 0 && !next.some((option) => option.recommended)) {
        return next.map((option, index) => (index === 0 ? { ...option, recommended: true } : option));
      }
      return next;
    });
  }

  function applyRates() {
    const { updated, pricingNotes: newNotes } = applyRateCardToCostBreakdown(costBreakdown, rateCard);
    setCostBreakdown(updated);
    if (newNotes.length) {
      setPricingNotes((current) => [current, ...newNotes].filter(Boolean).join("\n"));
      setSuccess("Rate Card pricing applied. Save changes to keep the new totals.");
      setError(null);
      return;
    }
    setError("No matching Rate Card items found for the remaining £0 lines.");
    setSuccess(null);
  }

  async function saveQuote() {
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/quotes/${quoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roof_report: roofReport,
        scope_of_works: scopeOfWorks,
        cost_breakdown: costBreakdown.map((item) => normaliseCostLine({ ...item, cost: Number(item.cost || 0) })),
        guarantee_text: guaranteeText,
        exclusions,
        terms,
        customer_email_subject: emailSubject,
        customer_email_body: emailBody,
        confidence,
        pricing_notes: pricingNotes
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        missing_info: missingInfo
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        options: options.map(normaliseOption)
      })
    });

    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Unable to save quote changes.");
      return;
    }

    setSuccess("Quote changes saved.");
    startTransition(() => router.refresh());
  }

  async function generatePdf() {
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/quotes/${quoteId}/pdf`, { method: "POST" });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Unable to generate the quote PDF.");
      return;
    }
    setSuccess(result.message || "Quote PDF generated.");
    startTransition(() => router.refresh());
  }

  async function polishQuoteWording() {
    setError(null);
    setSuccess(null);
    setPolishing(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/polish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roof_report: roofReport,
          scope_of_works: scopeOfWorks,
          guarantee_text: guaranteeText,
          exclusions,
          terms,
          customer_email_subject: emailSubject,
          customer_email_body: emailBody,
          cost_breakdown: costBreakdown.map((item) => normaliseCostLine({ ...item, cost: Number(item.cost || 0) })),
          missing_info: missingInfo
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          pricing_notes: pricingNotes
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        wording?: {
          roof_report: string;
          scope_of_works: string;
          guarantee_text: string;
          exclusions: string;
          terms: string;
          customer_email_subject: string;
          customer_email_body: string;
          cost_breakdown?: CostLineItem[];
          missing_info: string[];
          pricing_notes: string[];
        };
      } | null;

      if (!response.ok || !result?.ok || !result.wording) {
        throw new Error(result?.error || "Unable to polish quote wording.");
      }

      setRoofReport(result.wording.roof_report);
      setScopeOfWorks(result.wording.scope_of_works);
      setGuaranteeText(result.wording.guarantee_text);
      setExclusions(result.wording.exclusions);
      setTerms(result.wording.terms);
      setEmailSubject(result.wording.customer_email_subject);
      setEmailBody(result.wording.customer_email_body);
      setMissingInfo(result.wording.missing_info.join("\n"));
      setPricingNotes(result.wording.pricing_notes.join("\n"));
      setSuccess("Customer quote wording polished and saved. Prices were not changed.");
      startTransition(() => router.refresh());
    } catch (polishError) {
      setError(polishError instanceof Error ? polishError.message : "Unable to polish quote wording.");
    } finally {
      setPolishing(false);
    }
  }

  async function buildQuoteWithChatGpt() {
    const context = chatGptContext.trim();
    if (!context) {
      setError("Paste the job context, prices, notes, or supplier costs before asking ChatGPT to build the quote.");
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);
    setBuildingWithChatGpt(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/polish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "build_from_context",
          pasted_context: context,
          style_instructions: chatGptStyle,
          roof_report: roofReport,
          scope_of_works: scopeOfWorks,
          guarantee_text: guaranteeText,
          exclusions,
          terms,
          customer_email_subject: emailSubject,
          customer_email_body: emailBody,
          cost_breakdown: costBreakdown.map((item) => normaliseCostLine({ ...item, cost: Number(item.cost || 0) })),
          missing_info: missingInfo
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          pricing_notes: pricingNotes
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        wording?: {
          roof_report: string;
          scope_of_works: string;
          guarantee_text: string;
          exclusions: string;
          terms: string;
          customer_email_subject: string;
          customer_email_body: string;
          cost_breakdown?: CostLineItem[];
          missing_info: string[];
          pricing_notes: string[];
        };
      } | null;

      if (!response.ok || !result?.ok || !result.wording) {
        throw new Error(result?.error || "Unable to build quote from pasted context.");
      }

      setRoofReport(result.wording.roof_report);
      setScopeOfWorks(result.wording.scope_of_works);
      setGuaranteeText(result.wording.guarantee_text);
      setExclusions(result.wording.exclusions);
      setTerms(result.wording.terms);
      setEmailSubject(result.wording.customer_email_subject);
      setEmailBody(result.wording.customer_email_body);
      if (result.wording.cost_breakdown?.length) {
        setCostBreakdown(result.wording.cost_breakdown.map((item) => normaliseCostLine({ ...item, cost: Number(item.cost || 0) })));
      }
      setMissingInfo(result.wording.missing_info.join("\n"));
      setPricingNotes(result.wording.pricing_notes.join("\n"));
      setSuccess("ChatGPT built the quote in We Are Roofing style. Review the wording and prices, then save/approve when happy.");
      startTransition(() => router.refresh());
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "Unable to build quote from pasted context.");
    } finally {
      setBuildingWithChatGpt(false);
    }
  }

  async function editQuoteWithChatGpt() {
    const context = chatGptContext.trim();
    if (!context) {
      setError("Paste the edit instructions before asking ChatGPT to adjust this quote.");
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);
    setPolishing(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/polish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "polish",
          pasted_context: context,
          style_instructions: chatGptStyle,
          roof_report: roofReport,
          scope_of_works: scopeOfWorks,
          guarantee_text: guaranteeText,
          exclusions,
          terms,
          customer_email_subject: emailSubject,
          customer_email_body: emailBody,
          cost_breakdown: costBreakdown.map((item) => normaliseCostLine({ ...item, cost: Number(item.cost || 0) })),
          missing_info: missingInfo
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          pricing_notes: pricingNotes
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        wording?: {
          roof_report: string;
          scope_of_works: string;
          guarantee_text: string;
          exclusions: string;
          terms: string;
          customer_email_subject: string;
          customer_email_body: string;
          missing_info: string[];
          pricing_notes: string[];
        };
      } | null;

      if (!response.ok || !result?.ok || !result.wording) {
        throw new Error(result?.error || "Unable to edit quote with ChatGPT.");
      }

      setRoofReport(result.wording.roof_report);
      setScopeOfWorks(result.wording.scope_of_works);
      setGuaranteeText(result.wording.guarantee_text);
      setExclusions(result.wording.exclusions);
      setTerms(result.wording.terms);
      setEmailSubject(result.wording.customer_email_subject);
      setEmailBody(result.wording.customer_email_body);
      setMissingInfo(result.wording.missing_info.join("\n"));
      setPricingNotes(result.wording.pricing_notes.join("\n"));
      setSuccess("ChatGPT edited the existing quote wording. Prices and line items were kept unchanged.");
      startTransition(() => router.refresh());
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Unable to edit quote with ChatGPT.");
    } finally {
      setPolishing(false);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    const response = await fetch(`/api/quotes/${quoteId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_type: "admin", sender_name: "Andy", message: reply })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: (typeof messages)[number]; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Reply could not be sent.");
      return;
    }
    if (result.message) setMessages((current) => [...current, result.message as (typeof messages)[number]]);
    setReply("");
  }

  async function exportQuoteLinkedRoofPlan() {
    if (!roofSurvey) {
      setError("No saved roof takeoff found for this quote yet.");
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    const quoteMeta = currentQuote as QuoteRecord & Partial<{ job_ref: string; job_title: string; property_address: string; customer_name: string }>;
    const svg = buildTakeoffDrawingSvg({
      projectName: roofSurvey.project_name || quoteMeta.job_title || currentQuote.quote_ref,
      jobRef: quoteMeta.job_ref || currentQuote.quote_ref,
      address: quoteMeta.property_address || "",
      customerName: quoteMeta.customer_name || "",
      surveyDate: roofSurvey.created_at ? new Date(roofSurvey.created_at).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
      notes: [roofSurvey.notes, pricingNotes.trim()].filter(Boolean).join(" "),
      sections: roofSurvey.sections,
      lines: roofSurvey.lines,
      features: roofSurvey.features,
      style: "customer_quote",
      staticMapFraming: "close",
      googleMapsApiKey,
      quoteSections: buildDrawingQuoteSections(costBreakdown, roofSurvey)
    });

    printDrawing(svg, `${currentQuote.quote_ref}-quote-linked-roof-plan`);
    setSuccess("Quote-linked roof plan opened. Use the print dialog to save or send as PDF.");
  }

  return (
    <div className="stack">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Editable Draft</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Adjust wording, totals, and customer email content before approval.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="button-secondary" disabled={polishing || isPending} onClick={polishQuoteWording} type="button">
              {polishing ? "Polishing..." : "Polish Customer Quote"}
            </button>
            {rateCard.length ? (
              <button className="button-ghost" disabled={isPending} onClick={applyRates} type="button">
                Apply Rate Card
              </button>
            ) : null}
            <button className="button-secondary" disabled={isPending} onClick={generatePdf} type="button">
              Generate PDF
            </button>
            <button className="button-primary" disabled={isPending} onClick={saveQuote} type="button">
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      <div className="card border-[var(--gold)]/30 bg-[rgba(212,175,55,0.05)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">ChatGPT Quote Assistant</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Paste edit instructions, extra site context, customer priorities, takeoff notes, scaffold/access wording, WhatsApp notes, or rough bullet points. Use edit mode to improve the existing quote without changing prices, or build mode when you want ChatGPT to rebuild the quote from pasted context.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-primary" disabled={polishing || buildingWithChatGpt || isPending} onClick={editQuoteWithChatGpt} type="button">
              {polishing ? "Editing quote..." : "Edit existing quote"}
            </button>
            <button className="button-secondary" disabled={buildingWithChatGpt || polishing || isPending} onClick={buildQuoteWithChatGpt} type="button">
              {buildingWithChatGpt ? "Building quote..." : "Build full quote"}
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <label className="block">
            <span className="label">Paste edit instructions, context, or prices</span>
            <textarea
              className="field min-h-72 leading-7"
              onChange={(event) => setChatGptContext(event.target.value)}
              placeholder={`Example:\nCustomer wants rear flat roof sorted before winter.\nMeasured takeoff: rear flat 18.4m2, parapet 7.2lm, outlet detail needs attention.\nPrice EPDM system £1,850 + VAT, trims £220, waste/removal £180, scaffold tower £300.\nUse reassuring wording but mention hidden deck repairs are excluded unless opened up.`}
              value={chatGptContext}
            />
          </label>
          <div className="space-y-4">
            <label className="block">
              <span className="label">Style instructions</span>
              <textarea className="field min-h-40 leading-6" onChange={(event) => setChatGptStyle(event.target.value)} value={chatGptStyle} />
            </label>
            <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4 text-sm leading-6 text-[var(--muted)]">
              <p className="font-semibold text-white">Safe editing rules</p>
              <p className="mt-2"><strong className="text-[var(--gold-l)]">Edit existing quote</strong> keeps prices, VAT, and line items unchanged. It only improves wording.</p>
              <p className="mt-2"><strong className="text-[var(--gold-l)]">Build full quote</strong> may update line items, but only from prices already in the quote or prices you paste.</p>
              <p className="mt-2 text-[var(--gold-l)]">Always review before approving or sending.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Quote Options</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Create Option A/B/C comparisons before the customer accepts a route.</p>
          </div>
          <button className="button-ghost" onClick={addOption} type="button">
            {options.length ? "Add Option" : "Create Option A/B"}
          </button>
        </div>
        {options.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {options.map((option) => (
              <div
                className="rounded-2xl border p-4"
                key={option.id}
                style={{ borderColor: option.recommended ? "var(--gold)" : "var(--border)", background: "var(--surface-deep)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {option.recommended ? <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">Recommended</p> : null}
                    {!option.recommended ? <p className="section-kicker text-[0.65rem] uppercase">Quote option</p> : null}
                  </div>
                  <button className="button-ghost !px-3 !py-2 text-xs text-[#ff9a91]" onClick={() => deleteOption(option.id)} type="button">
                    Delete Option
                  </button>
                </div>
                <label className="mt-3 block">
                  <span className="label">Option label</span>
                  <input className="field" onChange={(event) => updateOption(option.id, { label: event.target.value })} value={option.label} />
                </label>
                <label className="mt-3 block">
                  <span className="label">Customer description</span>
                  <textarea className="field min-h-20" onChange={(event) => updateOption(option.id, { description: event.target.value })} value={option.description} />
                </label>
                <div className="mt-4 rounded-2xl border border-[var(--gold)]/30 bg-[rgba(212,175,55,0.07)] p-3">
                  <p className="section-kicker text-[0.62rem] uppercase text-[var(--gold)]">Section pricing</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    Add one roof works price and one scaffold/access price for each roof section. Both lines include VAT when the customer accepts this option.
                  </p>
                  <button className="button-primary mt-3 !min-h-10 !px-3 !py-2 text-xs" onClick={() => addSectionPackage(option.id)} type="button">
                    + Add roof section + scaffold price
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {option.cost_breakdown.map((line, index) => (
                      <div className="rounded-xl border border-[var(--border)] p-3" key={`${option.id}-${line.item}-${index}`}>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_150px_120px] xl:grid-cols-[minmax(0,1fr)_150px_150px_120px_92px_96px]">
                          <label className="block">
                            <span className="label">Item</span>
                            <input className="field" onChange={(event) => updateOptionLine(option.id, index, { item: event.target.value })} value={line.item} />
                          </label>
                          <label className="block">
                            <span className="label">Section</span>
                            <input className="field" onChange={(event) => updateOptionLine(option.id, index, { quote_section: event.target.value })} placeholder="Front slope" value={line.quote_section ?? ""} />
                          </label>
                          <label className="block">
                            <span className="label">Category</span>
                            <select
                              className="field"
                              onChange={(event) => updateOptionLine(option.id, index, { pricing_category: event.target.value })}
                              value={line.pricing_category || getQuoteLineItemCategory(line)}
                            >
                              <option value="roof_works">Roof works</option>
                              <option value="standard_scaffold">Standard scaffold</option>
                              <option value="temporary_roof_protection">Temporary roof protection</option>
                              <option value="access">Other access</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="label">Price</span>
                            <input className="field" inputMode="decimal" onChange={(event) => updateOptionLine(option.id, index, { cost: Number(event.target.value || 0) })} step="0.01" type="number" value={line.cost} />
                        </label>
                        <label className="mt-6 flex min-h-11 items-center gap-2 text-sm text-[var(--text)]">
                          <input checked={line.vat_applicable} onChange={(event) => updateOptionLine(option.id, index, { vat_applicable: event.target.checked })} type="checkbox" />
                          VAT
                        </label>
                        <button className="button-ghost mt-5 !min-h-11 !w-full !px-3 !py-2 text-xs text-[#ff9a91]" onClick={() => deleteOptionLine(option.id, index)} type="button">
                          Delete
                        </button>
                      </div>
                      <label className="mt-3 block">
                        <span className="label">Notes</span>
                        <textarea className="field min-h-16" onChange={(event) => updateOptionLine(option.id, index, { notes: event.target.value })} value={line.notes} />
                      </label>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary !px-3 !py-2 text-xs" onClick={() => addSectionPackage(option.id)} type="button">
                      + Add section roof + scaffold
                    </button>
                    <button className="button-ghost !px-3 !py-2 text-xs" onClick={() => addOptionLine(option.id)} type="button">
                      + Add single line
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 rounded-xl border border-[var(--border)] bg-black/10 p-3 text-sm">
                  {buildQuoteOptionPriceSummary(option).map((row) => (
                    <div className="space-y-1" key={row.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--muted)]">{row.label}</span>
                        <span>{currency(row.net)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-[var(--muted)]">{row.vatLabel}</span>
                        <span>{currency(row.vat)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between font-semibold text-[var(--gold-l)]">
                    <span>Total</span>
                    <span>{currency(option.total)}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                    <input checked={option.recommended} onChange={() => updateOption(option.id, { recommended: true })} type="radio" />
                    Mark recommended
                  </label>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-[var(--gold)]/30 bg-[rgba(212,175,55,0.07)] p-4">
            <p className="font-semibold text-white">Create customer-selectable quote options first.</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Once Option A/B exists, you can add section prices such as front roof works, front scaffold, rear roof works, and rear scaffold.
            </p>
            <button className="button-primary mt-4" onClick={addOption} type="button">
              Create Option A/B and add section pricing
            </button>
          </div>
        )}
      </div>

      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Quote Wording</p>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="label" htmlFor="roof-report">
              Roof Report
            </label>
            <textarea className="field min-h-72 leading-7" id="roof-report" onChange={(event) => setRoofReport(event.target.value)} value={roofReport} />
          </div>
          <div>
            <label className="label" htmlFor="scope-of-works">
              Scope of Works
            </label>
            <textarea className="field min-h-72 leading-7" id="scope-of-works" onChange={(event) => setScopeOfWorks(event.target.value)} value={scopeOfWorks} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="guarantee-text">
                Guarantee
              </label>
              <textarea className="field min-h-44 leading-7" id="guarantee-text" onChange={(event) => setGuaranteeText(event.target.value)} value={guaranteeText} />
            </div>
            <div>
              <label className="label" htmlFor="exclusions">
                Exclusions
              </label>
              <textarea className="field min-h-44 leading-7" id="exclusions" onChange={(event) => setExclusions(event.target.value)} value={exclusions} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="terms">
              Terms
            </label>
            <textarea className="field min-h-52 leading-7" id="terms" onChange={(event) => setTerms(event.target.value)} value={terms} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-kicker text-[0.65rem] uppercase">Cost Breakdown</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Rate Card matches fill £0 lines from survey quantities where possible.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-primary" onClick={addMainSectionPackage} type="button">
              + Add section roof + scaffold
            </button>
            {roofSurvey?.sections.length ? (
              <button className="button-secondary" onClick={addTakeoffSectionPackages} type="button">
                + Add all drawing sections
              </button>
            ) : null}
            {roofSurvey ? (
              <button className="button-secondary" onClick={() => void exportQuoteLinkedRoofPlan()} type="button">
                Export quote-linked roof plan
              </button>
            ) : null}
            <Link className="button-ghost" href={"/settings/rates" as Route}>
              Open Rate Card
            </Link>
          </div>
        </div>
        {unpricedLines.length ? (
          <div className="mt-4 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4 text-sm text-[var(--gold-l)]">
            {unpricedLines.length} line{unpricedLines.length === 1 ? "" : "s"} still need pricing. Add matching item names in the Rate Card, or enter the total manually.
          </div>
        ) : null}
        {quoteSections.length ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">Takeoff Linked Quote Sections</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Each block comes from a marked-up area, line, or roof item in the takeoff drawing.</p>
              </div>
              <span className="rounded-full border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--gold-l)]">
                {quoteSections.length} section{quoteSections.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {quoteSections.map((section) => (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" key={section.name}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{section.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{section.measurements.join(" · ") || "Manual quote section"}</p>
                    </div>
                    <p className="font-semibold text-[var(--gold-l)]">{currency(section.total)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {section.colors.map((color) => (
                      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" key={`${section.name}-${color}`} style={{ background: color }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4 space-y-4">
          <TakeoffQuotePreview selectedSourceId={selectedTakeoffSourceId} survey={roofSurvey} />
          {costBreakdown.length > 0 ? costBreakdown.map((line, index) => {
            const isScaffoldLine = (line.pricing_category || "").includes("scaffold") || line.item.toLowerCase().includes("scaffold");
            const canAddScaffoldLine = Boolean(line.source_id || line.quote_section) && !isScaffoldLine;
            return (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-deep)] p-5" key={`${line.item}-${index}`}>
              {line.source_type || line.measurement_label || line.quote_section ? (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-black/15 p-3 text-xs text-[var(--muted)]">
                  {line.source_color ? <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: line.source_color }} /> : null}
                  <span className="font-semibold uppercase tracking-[0.16em] text-[var(--gold-l)]">
                    {line.source_type ? `Takeoff ${line.source_type}` : "Takeoff item"}
                  </span>
                  {line.source_label ? <span>{line.source_label}</span> : null}
                  {line.measurement_label ? <span className="rounded-full border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-2 py-1 font-semibold text-[var(--gold-l)]">{line.measurement_label}</span> : null}
                  {line.pricing_category ? <span className="rounded-full border border-[var(--border)] px-2 py-1">Rate: {line.pricing_category}</span> : null}
                  {line.source_id ? (
                    <button
                      className="rounded-full border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-3 py-1 font-semibold text-[var(--gold-l)] transition hover:border-[var(--gold)]"
                      onClick={() => setSelectedTakeoffSourceId(line.source_id ?? null)}
                      type="button"
                    >
                      View on drawing
                    </button>
                  ) : null}
                  {canAddScaffoldLine ? (
                    <button
                      className="rounded-full border border-[var(--gold)]/35 bg-[var(--gold)] px-3 py-1 font-semibold text-black transition hover:opacity-90"
                      onClick={() => addScaffoldLineForTakeoff(index)}
                      type="button"
                    >
                      + Scaffold VAT line
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <div>
                  <label className="label" htmlFor={`line-item-${index}`}>
                    Item / work type
                  </label>
                  <input
                    className="field"
                    id={`line-item-${index}`}
                    placeholder="Roof works, Scaffold/access, Chimney repairs..."
                    onChange={(event) => updateLine(index, { item: event.target.value })}
                    value={line.item}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`line-quote-section-${index}`}>
                    Section / drawing area
                  </label>
                  <input
                    className="field"
                    id={`line-quote-section-${index}`}
                    onChange={(event) => updateLine(index, { quote_section: event.target.value })}
                    placeholder="Front slope, rear flat roof, chimney stack..."
                    value={line.quote_section ?? ""}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_120px_110px_130px_150px]">
                <div>
                  <label className="label" htmlFor={`line-pricing-category-${index}`}>
                    Category
                  </label>
                  <select
                    className="field"
                    id={`line-pricing-category-${index}`}
                    onChange={(event) => updateLine(index, { pricing_category: event.target.value })}
                    value={line.pricing_category || getQuoteLineItemCategory(line)}
                  >
                    <option value="roof_works">Roof works</option>
                    <option value="standard_scaffold">Scaffold/access</option>
                    <option value="temporary_roof_protection">Temporary roof protection</option>
                    <option value="access">Other access</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`line-quantity-${index}`}>
                    Quantity
                  </label>
                  <input
                    className="field"
                    id={`line-quantity-${index}`}
                    inputMode="decimal"
                    onChange={(event) => updateLine(index, { quantity: Number(event.target.value || 0) })}
                    step="0.01"
                    type="number"
                    value={line.quantity ?? ""}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`line-unit-${index}`}>
                    Unit
                  </label>
                  <input
                    className="field"
                    id={`line-unit-${index}`}
                    onChange={(event) => updateLine(index, { unit: event.target.value })}
                    placeholder="m2 / lm / item"
                    value={line.unit ?? ""}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`line-unit-rate-${index}`}>
                    Unit rate
                  </label>
                  <input
                    className="field"
                    id={`line-unit-rate-${index}`}
                    inputMode="decimal"
                    onChange={(event) => updateLine(index, { unit_rate: Number(event.target.value || 0) })}
                    step="0.01"
                    type="number"
                    value={line.unit_rate ?? ""}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`line-cost-${index}`}>
                    Net price
                  </label>
                  <input
                    className="field"
                    id={`line-cost-${index}`}
                    onChange={(event) => updateLine(index, { cost: Number(event.target.value || 0) })}
                    step="0.01"
                    type="number"
                    value={line.cost}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-black/15 p-3 text-sm">
                <label className="flex items-center gap-3 text-[var(--text)]">
                  <input checked={line.vat_applicable} onChange={(event) => updateLine(index, { vat_applicable: event.target.checked })} type="checkbox" />
                  VAT applies to this line
                </label>
                <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
                  <span className="text-[var(--muted)]">Net: <strong className="text-white">{currency(Number(line.cost || 0))}</strong></span>
                  <span className="text-[var(--muted)]">VAT: <strong className="text-white">{currency(line.vat_applicable ? Number(line.cost || 0) * 0.2 : 0)}</strong></span>
                  <span className="text-[var(--gold-l)]">Inc VAT: <strong>{currency(Number(line.cost || 0) + (line.vat_applicable ? Number(line.cost || 0) * 0.2 : 0))}</strong></span>
                </div>
                <button className="button-ghost !min-h-10 !px-3 !py-2 text-xs text-[#ff9a91]" onClick={() => deleteLine(index)} type="button">
                  Delete line
                </button>
              </div>
              <div className="mt-4">
                <label className="label" htmlFor={`line-notes-${index}`}>
                  Description / customer notes
                </label>
                <textarea
                  className="field min-h-20"
                  id={`line-notes-${index}`}
                  onChange={(event) => updateLine(index, { notes: event.target.value })}
                  placeholder="Explain what is included for this section, access requirements, exclusions, or drawing reference."
                  value={line.notes}
                />
              </div>
            </div>
          );
          }) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-black/10 p-4 text-sm text-[var(--muted)]">
              No line items in this quote yet. Add one below before saving if the quote needs pricing.
            </div>
          )}
          <button
            className="button-ghost"
            onClick={() =>
              setCostBreakdown((current) => [...current, { item: "Additional works", cost: 0, vat_applicable: false, notes: "" }])
            }
            type="button"
          >
            Add Line Item
          </button>
        </div>
        <div className="mt-5 grid gap-2 rounded-2xl border border-[var(--border)] p-4 text-sm md:max-w-sm md:ml-auto">
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">Subtotal</span>
            <span>{currency(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">VAT</span>
            <span>{currency(totals.vat)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-[var(--gold-l)]">
            <span>Total</span>
            <span>{currency(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Email and Review Notes</p>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="label" htmlFor="email-subject">
              Customer Email Subject
            </label>
            <input className="field" id="email-subject" onChange={(event) => setEmailSubject(event.target.value)} value={emailSubject} />
          </div>
          <div>
            <label className="label" htmlFor="email-body">
              Customer Email Body
            </label>
            <textarea className="field min-h-56 leading-7" id="email-body" onChange={(event) => setEmailBody(event.target.value)} value={emailBody} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="confidence">
                Confidence
              </label>
              <select className="field" id="confidence" onChange={(event) => setConfidence(event.target.value as QuoteRecord["confidence"])} value={confidence ?? "Medium"}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="pricing-notes">
                Pricing Notes
              </label>
              <textarea className="field min-h-36 leading-7" id="pricing-notes" onChange={(event) => setPricingNotes(event.target.value)} value={pricingNotes} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="missing-info">
              Missing Info
            </label>
            <textarea className="field min-h-36 leading-7" id="missing-info" onChange={(event) => setMissingInfo(event.target.value)} value={missingInfo} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <p className="section-kicker text-[0.65rem] uppercase">Customer Messages</p>
        <div className="mt-4 space-y-3">
          {messages.length ? (
            messages.map((message) => (
              <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-4 text-sm" key={message.id}>
                <p className="font-semibold text-white">{message.sender_type === "admin" ? "We Are Roofing" : message.sender_name || "Customer"}</p>
                <p className="mt-2 text-[var(--muted)]">{message.message}</p>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-[var(--border)] bg-black/10 p-4 text-sm text-[var(--muted)]">No customer questions on this quote yet.</p>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <textarea className="field min-h-20 md:flex-1" onChange={(event) => setReply(event.target.value)} placeholder="Reply to the customer..." value={reply} />
          <button className="button-primary h-11" onClick={sendReply} type="button">
            Send Reply
          </button>
        </div>
      </div>

      {success ? <p className="text-sm text-[#7ce3a6]">{success}</p> : null}
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}

function normaliseOption(option: QuoteOption): QuoteOption {
  return normaliseQuoteOption(option);
}

function normaliseCostLine(line: CostLineItem, updates: Partial<CostLineItem> = {}) {
  const quantity = typeof line.quantity === "number" && Number.isFinite(line.quantity) ? line.quantity : undefined;
  const unitRate = typeof line.unit_rate === "number" && Number.isFinite(line.unit_rate) ? line.unit_rate : undefined;
  const shouldRecalculate = ("quantity" in updates || "unit_rate" in updates) && quantity != null && unitRate != null;

  return {
    ...normaliseQuoteCostLine(line),
    quantity,
    unit_rate: unitRate,
    cost: shouldRecalculate ? Math.round(quantity * unitRate * 100) / 100 : Number(line.cost || 0)
  };
}

function groupQuoteSections(lines: CostLineItem[]) {
  const groups = new Map<string, { name: string; total: number; measurements: string[]; colors: string[] }>();

  lines.forEach((line) => {
    const name = line.quote_section?.trim() || line.source_label?.trim() || "General Works";
    const existing = groups.get(name) ?? { name, total: 0, measurements: [], colors: [] };
    existing.total += Number(line.cost || 0);
    if (line.measurement_label && !existing.measurements.includes(line.measurement_label)) {
      existing.measurements.push(line.measurement_label);
    }
    if (line.source_color && !existing.colors.includes(line.source_color)) {
      existing.colors.push(line.source_color);
    }
    groups.set(name, existing);
  });

  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildDrawingQuoteSections(lines: CostLineItem[], survey: RoofSurveyRecord): DrawingQuoteSection[] {
  const groups = new Map<
    string,
    {
      label: string;
      roofNet: number;
      accessNet: number;
      vat: number;
      total: number;
      measurement?: string;
      sourceId?: string;
    }
  >();

  lines.forEach((line) => {
    const label = line.quote_section?.trim() || line.source_label?.trim() || "General Works";
    const existing = groups.get(label) ?? { label, roofNet: 0, accessNet: 0, vat: 0, total: 0, measurement: line.measurement_label, sourceId: line.source_id };
    const net = Number(line.cost || 0);
    const vat = line.vat_applicable ? net * 0.2 : 0;
    const category = getQuoteLineItemCategory(line);

    if (category === "roof_works") {
      existing.roofNet += net;
    } else {
      existing.accessNet += net;
    }

    existing.vat += vat;
    existing.total += net + vat;
    existing.measurement ||= line.measurement_label;
    existing.sourceId ||= line.source_id;
    groups.set(label, existing);
  });

  return [...groups.values()]
    .sort((left, right) => drawingSectionIndex(left, survey) - drawingSectionIndex(right, survey))
    .map((group, index) => {
      const sectionIndex = drawingSectionIndex(group, survey);
      return {
        code: sectionIndex >= 0 && sectionIndex < 999 ? `S${sectionIndex + 1}` : `Q${index + 1}`,
        label: group.label,
        measurement: group.measurement,
        roofNet: Math.round(group.roofNet * 100) / 100,
        accessNet: Math.round(group.accessNet * 100) / 100,
        vat: Math.round(group.vat * 100) / 100,
        total: Math.round(group.total * 100) / 100
      };
    });
}

function drawingSectionIndex(group: { label: string; sourceId?: string }, survey: RoofSurveyRecord) {
  const index = survey.sections.findIndex((section) => {
    const labelMatches = section.label?.trim().toLowerCase() === group.label.trim().toLowerCase();
    const idMatches = Boolean(group.sourceId && section.id === group.sourceId);
    return labelMatches || idMatches;
  });

  return index >= 0 ? index : 1000;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "section";
}
