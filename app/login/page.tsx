import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const defaultEmail = process.env.NEXT_PUBLIC_MVP_ADMIN_EMAIL ?? "werroofing@gmail.com";

  return (
    <AppShell
      title="Sign In"
      subtitle="This is now the front door to the app. On a successful Supabase login the session should stay active, so you go straight back into the app until you sign out."
    >
      <div className="mx-auto max-w-xl">
        <div className="card p-6 md:p-8">
          <div className="stack">
            <Suspense fallback={<div className="text-sm text-[var(--muted)]">Loading sign-in…</div>}>
              <LoginForm authEnabled={authEnabled} defaultEmail={defaultEmail} />
            </Suspense>
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(212,175,55,0.05)] p-4 text-sm text-[var(--muted)]">
              <p className="text-[var(--text)]">Admin account: {defaultEmail}</p>
              <p className="mt-2">Once signed in successfully, the app should keep the session and open straight back into the protected area.</p>
              {!authEnabled ? <p className="mt-2 text-[#ff9a91]">Supabase env vars are not configured in this environment yet.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
