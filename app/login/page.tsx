import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const defaultEmail = process.env.NEXT_PUBLIC_MVP_ADMIN_EMAIL ?? "werroofing@gmail.com";

  return (
    <main className="min-h-screen bg-[var(--obsidian)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <div className="card p-6 md:p-8">
          <div className="stack">
            <div>
              <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">We Are Roofing OS</p>
              <h1 className="mt-3 font-display text-4xl text-[var(--text-primary)]">Sign in</h1>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Sign in to manage today&apos;s jobs, customers, quotes, invoices and messages.
              </p>
            </div>
            <Suspense fallback={<div className="text-sm text-[var(--muted)]">Loading sign-in...</div>}>
              <LoginForm authEnabled={authEnabled} defaultEmail={defaultEmail} />
            </Suspense>
            {!authEnabled ? (
              <div className="rounded-xl border border-[var(--stage-alert-border)] bg-[var(--stage-alert-bg)] p-4 text-sm text-[var(--stage-alert-text)]">
                Supabase env vars are not configured in this environment yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
