import type { Job, QuoteOption, QuoteRecord } from "@/lib/types";

type QuoteValue = Pick<QuoteRecord, "total" | "options" | "accepted_option_id">;
type JobValue = Pick<Job, "estimated_value" | "final_value" | "status"> & {
  quote?: QuoteValue | null;
};

export function getPositiveNumber(value: unknown): number | null {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function getLowestOptionTotal(options?: QuoteOption[] | null): number | null {
  const totals = (options ?? []).map((option) => getPositiveNumber(option.total)).filter((value): value is number => value !== null);
  return totals.length > 0 ? Math.min(...totals) : null;
}

export function getAcceptedOptionTotal(quote?: Pick<QuoteValue, "options" | "accepted_option_id"> | null): number | null {
  if (!quote?.accepted_option_id) return null;
  const acceptedOption = (quote.options ?? []).find((option) => option.id === quote.accepted_option_id);
  return getPositiveNumber(acceptedOption?.total);
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
