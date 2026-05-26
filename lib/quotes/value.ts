import type { CostLineItem, Job, QuoteOption, QuoteRecord } from "@/lib/types";

type QuoteValue = Pick<QuoteRecord, "total" | "options" | "accepted_option_id">;
type JobValue = Pick<Job, "estimated_value" | "final_value" | "status"> & {
  quote?: QuoteValue | null;
};

export function getPositiveNumber(value: unknown): number | null {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function getLowestOptionTotal(options?: QuoteOption[] | null): number | null {
  const totals = (options ?? []).map((option) => getOptionTotal(option)).filter((value): value is number => value !== null);
  return totals.length > 0 ? Math.min(...totals) : null;
}

export function getAcceptedOptionTotal(quote?: Pick<QuoteValue, "options" | "accepted_option_id"> | null): number | null {
  if (!quote?.accepted_option_id) return null;
  const acceptedOption = (quote.options ?? []).find((option) => option.id === quote.accepted_option_id);
  return acceptedOption ? getOptionTotal(acceptedOption) : null;
}

export function getQuotePipelineValue(quote?: QuoteValue | null): number | null {
  if (!quote) return null;
  return getAcceptedOptionTotal(quote) ?? getLowestOptionTotal(quote.options) ?? getPositiveNumber(quote.total);
}

export function getJobPipelineValue(job: JobValue): number | null {
  if (job.status === "Completed") {
    return getPositiveNumber(job.final_value) ?? getPositiveNumber(job.estimated_value) ?? getQuotePipelineValue(job.quote);
  }

  return getQuotePipelineValue(job.quote) ?? getPositiveNumber(job.estimated_value);
}

export function isFromOptionValue(job: JobValue): boolean {
  return Boolean(job.quote?.options?.length && !job.quote.accepted_option_id && getLowestOptionTotal(job.quote.options));
}

export function isQuoteFromOptionValue(quote?: QuoteValue | null): boolean {
  return Boolean(quote?.options?.length && !quote.accepted_option_id && getLowestOptionTotal(quote.options));
}

export function getOptionTotal(option: QuoteOption): number | null {
  return getPositiveNumber(option.total) ?? getPositiveNumber(option.subtotal + option.vat_amount) ?? calculateLineTotal(option.cost_breakdown);
}

function calculateLineTotal(lines?: CostLineItem[] | null) {
  if (!lines?.length) return null;
  const subtotal = lines.reduce((sum, line) => sum + Number(line.cost || 0), 0);
  const vat = lines.filter((line) => line.vat_applicable !== false).reduce((sum, line) => sum + Number(line.cost || 0) * 0.2, 0);
  return getPositiveNumber(Math.round((subtotal + vat) * 100) / 100);
}
