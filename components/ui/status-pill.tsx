import { StatusBadge } from "@/components/ui/StatusBadge";
import { QUOTE_STATUS_COLORS } from "@/lib/theme/statusColors";
import type { JobStatus, QuoteStatus } from "@/lib/types";

type Props = {
  status: JobStatus | QuoteStatus;
};

export function StatusPill({ status }: Props) {
  const type = status in QUOTE_STATUS_COLORS ? "quote" : "job";
  return <StatusBadge showDot status={status} type={type} />;
}
