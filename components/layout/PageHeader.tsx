import { AssistantQuickPrompts } from "@/components/assistant/AssistantQuickPrompts";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  /** Action buttons shown on the right of the header. Use sparingly — max 2-3. */
  actions?: React.ReactNode;
  /** Breadcrumb / back link rendered above the title on mobile + desktop. */
  breadcrumb?: React.ReactNode;
  /** Apply sticky positioning on mobile so the title and primary action stay visible. */
  sticky?: boolean;
};

export function PageHeader({ title, subtitle, actions, breadcrumb, sticky = true }: Props) {
  return (
    <header
      className={cn(
        "page-header no-print",
        sticky &&
          "lg:static lg:bg-[var(--obsidian)] lg:backdrop-blur-none"
      )}
      style={
        sticky
          ? {
              position: "sticky",
              top: 0,
              zIndex: 30,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              background: "color-mix(in srgb, var(--obsidian) 88%, transparent)"
            }
          : undefined
      }
    >
      <div className="min-w-0 flex-1">
        {breadcrumb ? <div className="mb-1 text-xs text-[var(--text-muted)]">{breadcrumb}</div> : null}
        <h1 className="page-title truncate">{title}</h1>
        {subtitle ? <p className="page-subtitle line-clamp-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
      <div className="hidden lg:block">
        <AssistantQuickPrompts />
      </div>
    </header>
  );
}
