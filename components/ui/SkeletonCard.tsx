export function SkeletonCard() {
  return (
    <div className="card animate-pulse p-5">
      <div className="h-4 w-24 rounded-full bg-white/10" />
      <div className="mt-4 h-7 w-2/3 rounded-full bg-white/10" />
      <div className="mt-3 h-4 w-full rounded-full bg-white/10" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="h-10 rounded-2xl bg-white/10" />
        <div className="h-10 rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}
