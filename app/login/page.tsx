import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";

export default function LoginPage() {
  return (
    <AppShell
      title="Sign In"
      subtitle="This MVP is set up for one business admin. Once Supabase Auth is connected, this screen becomes the live sign-in gate."
    >
      <div className="mx-auto max-w-xl">
        <div className="card p-6 md:p-8">
          <div className="stack">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input className="field" id="email" placeholder="hello@weareroofing.co.uk" type="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input className="field" id="password" placeholder="Password" type="password" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="button-primary" href="/dashboard">
                Enter Dashboard
              </Link>
              <span className="button-ghost">Supabase Auth wiring next</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

