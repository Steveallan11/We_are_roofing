import { redirect } from "next/navigation";
import type { Route } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ConsentPageProps = {
  searchParams: Promise<{ authorization_id?: string }>;
};

function requestedPermissions(scope: string) {
  const labels: Record<string, string> = {
    openid: "Confirm your identity",
    email: "View your account email",
    profile: "View your basic account profile"
  };

  return scope
    .split(/\s+/)
    .filter(Boolean)
    .map((item) => labels[item] ?? item);
}

export default async function OAuthConsentPage({ searchParams }: ConsentPageProps) {
  const { authorization_id: authorizationId } = await searchParams;

  if (!authorizationId) {
    return <ConsentMessage title="Invalid request" message="The authorization request is missing its identifier." />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(next)}` as Route);
  }

  const allowedEmail = (process.env.MVP_ADMIN_EMAIL || process.env.NEXT_PUBLIC_MVP_ADMIN_EMAIL)
    ?.trim()
    .toLowerCase();

  if (!allowedEmail || user.email?.toLowerCase() !== allowedEmail) {
    return (
      <ConsentMessage
        title="Account not authorised"
        message="This ChatGPT connection is restricted to the We Are Roofing administrator account."
      />
    );
  }

  const { data: authorization, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !authorization) {
    return (
      <ConsentMessage
        title="Authorization request expired"
        message={error?.message || "Start the connection again from ChatGPT."}
      />
    );
  }

  if (!("authorization_id" in authorization)) {
    redirect(authorization.redirect_url as Route);
  }

  const permissions = requestedPermissions(authorization.scope);

  return (
    <main className="min-h-screen bg-[var(--obsidian)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <div className="card w-full p-6 md:p-8">
          <div className="stack">
            <div>
              <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">Secure connection</p>
              <h1 className="mt-3 font-display text-4xl text-[var(--text-primary)]">Connect {authorization.client.name}</h1>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Allow this app to use the We Are Roofing tools on behalf of {user.email}.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Requested access</p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                {permissions.map((permission) => (
                  <li key={permission}>• {permission}</li>
                ))}
                <li>• Read customers, jobs, quotes and pipeline summaries</li>
                <li>• Create jobs and update job workflow details</li>
                <li>• Archive a job only after you explicitly confirm it</li>
                <li>• Draft customer emails and attach saved literature</li>
                <li>• Send an email only after you review and explicitly confirm the saved draft</li>
              </ul>
              <p className="mt-4 text-xs text-[var(--muted)]">
                These tools cannot delete records. ChatGPT will show confirmation before archiving or sending customer communications.
              </p>
            </div>

            <form action="/oauth/consent/decision" className="flex flex-wrap gap-3" method="post">
              <input name="authorization_id" type="hidden" value={authorizationId} />
              <button className="button-primary" name="decision" type="submit" value="approve">
                Allow access
              </button>
              <button className="button-ghost" name="decision" type="submit" value="deny">
                Deny
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function ConsentMessage({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-[var(--obsidian)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <div className="card w-full p-6 md:p-8">
          <p className="section-kicker text-[0.65rem] uppercase text-[var(--gold)]">Secure connection</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--text-primary)]">{title}</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>
        </div>
      </div>
    </main>
  );
}
