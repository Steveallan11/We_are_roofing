type Props = {
  label: string;
  value: string | number;
  hint?: string;
};

export function MetricCard({ label, value, hint }: Props) {
  return (
    <div className="card p-4 lg:p-5">
      <p className="section-kicker text-[0.65rem] uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl text-[var(--gold-l)] lg:mt-3 lg:text-4xl">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
