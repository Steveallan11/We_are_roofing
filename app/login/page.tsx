import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Starfield } from "@/components/ui/starfield";

export default function LoginPage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const defaultEmail = process.env.NEXT_PUBLIC_MVP_ADMIN_EMAIL ?? "werroofing@gmail.com";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--obsidian)] px-4 py-10">
      <Starfield />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <div className="card p-6 md:p-8">
          <div className="stack">
            <div>
              <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">We Are Roofing OS</p>
              <h1 className="mt-3 font-display text-4xl text-white">Sign in</h1>
              <p className="mt-3 text-sm text-[var(--muted)]">
                This is the secure front door to the admin app. Once signed in, your Supabase session stays active until you sign out.
              </p>
            </div>
            <Suspense fallback={<div className="text-sm text-[var(--muted)]">Loading sign-in...</div>}>
              <LoginForm authEnabled={authEnabled} defaultEmail={defaultEmail} />
            </Suspense>
            {!authEnabled ? (
              <div className="rounded-2xl border border-[#ff9a91]/35 bg-[#ff9a91]/10 p-4 text-sm text-[#ffb8b1]">
                Supabase env vars are not configured in this environment yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
