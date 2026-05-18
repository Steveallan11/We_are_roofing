import { CONDITION_COLORS, INVOICE_STATUS_COLORS, QUOTE_STATUS_COLORS, STATUS_COLORS, URGENCY_COLORS } from "@/lib/theme/statusColors";

type BadgeType = "job" | "quote" | "invoice" | "condition" | "urgency";

type StatusBadgeProps = {
  status: string;
  type?: BadgeType;
  size?: "sm" | "md";
  showDot?: boolean;
};

type BadgeConfig = {
  color: string;
  bg: string;
  border?: string;
  label: string;
};

export function StatusBadge({ status, type = "job", size = "md", showDot = true }: StatusBadgeProps) {
  const map =
    type === "quote"
      ? QUOTE_STATUS_COLORS
      : type === "invoice"
        ? INVOICE_STATUS_COLORS
        : type === "condition"
          ? CONDITION_COLORS
          : type === "urgency"
            ? URGENCY_COLORS
            : STATUS_COLORS;
  const cfg = ((map as Record<string, BadgeConfig>)[status] ?? {
    color: "var(--text-muted)",
    bg: "rgba(136,136,136,0.10)",
    border: "rgba(136,136,136,0.20)",
    label: status
  }) as BadgeConfig;

  return (
    <span
      style={{
        alignItems: "center",
        background: cfg.bg,
        border: `1px solid ${cfg.border || cfg.bg}`,
        borderRadius: 4,
        color: cfg.color,
        display: "inline-flex",
        fontFamily: "var(--font-ui)",
        fontSize: size === "sm" ? 8 : 9,
        fontWeight: 700,
        gap: showDot ? 5 : 0,
        letterSpacing: "0.06em",
        padding: size === "sm" ? "1px 6px" : "2px 8px",
        textTransform: "uppercase",
        whiteSpace: "nowrap"
      }}
    >
      {showDot ? (
        <span
          style={{
            background: cfg.color,
            borderRadius: "50%",
            boxShadow: `0 0 4px ${cfg.color}60`,
            flexShrink: 0,
            height: 5,
            width: 5
          }}
        />
      ) : null}
      {cfg.label || status}
    </span>
  );
}
