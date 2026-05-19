import { AssistantQuickPrompts } from "@/components/assistant/AssistantQuickPrompts";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="page-header no-print">
      <div className="min-w-0 flex-1">
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
