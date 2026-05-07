"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    await fetch("/api/auth/logout", { method: "POST" });
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button className="button-ghost" disabled={isPending} onClick={handleLogout} type="button">
      {isPending ? "Signing Out..." : "Sign Out"}
    </button>
  );
}
