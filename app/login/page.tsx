import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const defaultEmail = process.env.NEXT_PUBLIC_MVP_ADMIN_EMAIL ?? "werroofing@gmail.com";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-md w-full p-8">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">We Are Roofing OS</p>
          <h1 className="mt-2 font-condensed text-3xl text-white">Admin Sign In</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Sign in with the We Are Roofing admin account to access the live dashboard, pipeline, customers, and job workflow.</p>
        </div>
        <div className="mt-6">
          <Suspense fallback={<div className="text-sm text-[var(--muted)]">Loading sign-in...</div>}>
            <LoginForm authEnabled={authEnabled} defaultEmail={defaultEmail} />
          </Suspense>
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[rgba(212,175,55,0.05)] p-4 text-sm text-[var(--muted)]">
          <p className="text-[var(--text)]">Admin account: {defaultEmail}</p>
          <p className="mt-2">The session should stay live until you sign out.</p>
          {!authEnabled ? <p className="mt-2 text-[#ff9a91]">Supabase auth env vars are not configured for this environment yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
