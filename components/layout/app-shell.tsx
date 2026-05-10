import Link from 'next/link';

type Props = { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode };

export function AppShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-condensed text-3xl text-white">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
