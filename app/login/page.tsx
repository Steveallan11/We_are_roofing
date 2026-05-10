import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card p-8 max-w-sm w-full text-center">
        <p className="text-4xl mb-3">🔒</p>
        <h1 className="font-condensed text-2xl text-white">Login</h1>
        <p className="text-sm text-[var(--muted)] mt-2">Authentication coming in Phase 4.</p>
        <Link className="button-primary mt-4 inline-block text-sm" href="/dashboard">Continue to Dashboard</Link>
      </div>
    </div>
  );
}
