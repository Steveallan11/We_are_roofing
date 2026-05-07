type Props = {
  label: string;
  value: string | number;
  hint?: string;
};

export function MetricCard({ label, value, hint }: Props) {
  return (
    <div className="card p-5">
      <p className="section-kicker text-[0.65rem] uppercase">{label}</p>
      <p className="mt-3 font-display text-4xl text-[var(--gold-l)]">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

