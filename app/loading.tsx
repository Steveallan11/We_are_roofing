export default function AppLoading() {
  return (
    <main aria-busy="true" aria-label="Loading" className="min-h-screen bg-[var(--obsidian)] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div className="h-28 animate-pulse rounded-2xl bg-white/5" key={item} />)}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
        <p className="sr-only">Loading your work…</p>
      </div>
    </main>
  );
}
