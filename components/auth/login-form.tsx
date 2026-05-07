"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  defaultEmail: string;
  authEnabled: boolean;
};

export function LoginForm({ defaultEmail, authEnabled }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const next = (searchParams.get("next") || "/dashboard") as Route;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!authEnabled) {
      setError("Supabase Auth is not configured yet. Add the live env vars first.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    startTransition(() => {
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          className="field"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="hello@weareroofing.co.uk"
          type="email"
          value={email}
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          className="field"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          value={password}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="button-primary" disabled={isPending} type="submit">
          {isPending ? "Signing In..." : "Enter Admin Dashboard"}
        </button>
        <span className="button-ghost">Session stays live until sign out</span>
      </div>
      {error ? <p className="text-sm text-[#ff9a91]">{error}</p> : null}
    </form>
  );
}
