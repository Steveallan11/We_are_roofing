"use client";

import { useState } from "react";

export function PublicVariationActions({ variationId, token, quoteRef, itemCount }: { variationId: string; token: string; quoteRef: string; itemCount: number }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function respond(decision: "accept" | "decline") {
    setError(null);
    setSuccess(null);
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter your full name and a valid email address.");
      return;
    }
    setBusy(decision);
    const response = await fetch(`/api/variations/${variationId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, decision, name: name.trim(), email: email.trim() })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    setBusy(null);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Your response could not be recorded.");
      return;
    }
    setSuccess(result.message || "Thank you. Your response has been recorded.");
  }

  if (success) {
    return (
      <div className="rounded-3xl border border-[#2d9b5f]/40 bg-[#143a26] p-6 text-center md:p-8">
        <p className="font-display text-3xl text-white">Response received</p>
        <p className="mt-3 font-ui text-base leading-7 text-[#d9f5e5]">{success}</p>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-[#d6c78f] bg-[#faf6e8] p-5 text-[#1f1f1f] md:p-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8d6a00]">Your decision · {quoteRef}</p>
      <h2 className="mt-3 font-display text-3xl leading-tight md:text-4xl">Approve this additional works quote?</h2>
      <p className="mt-3 font-ui text-base leading-7 text-[#555]">Your response applies to {itemCount === 1 ? "the item above" : `all ${itemCount} linked items above`}. Enter your details so we can record your decision.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label>
          <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#555]">Full name</span>
          <input className="mt-2 min-h-12 w-full rounded-xl border border-[#b9aa78] bg-white px-4 text-base text-[#1f1f1f]" onChange={(event) => setName(event.target.value)} value={name} />
        </label>
        <label>
          <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#555]">Email address</span>
          <input className="mt-2 min-h-12 w-full rounded-xl border border-[#b9aa78] bg-white px-4 text-base text-[#1f1f1f]" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
        </label>
      </div>
      {error ? <p className="mt-4 text-sm font-semibold text-[#a51d1d]">{error}</p> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button className="min-h-14 rounded-xl bg-[#D4AF37] px-5 font-ui text-base font-extrabold text-black disabled:opacity-60" disabled={busy !== null} onClick={() => respond("accept")} type="button">
          {busy === "accept" ? "Recording approval..." : itemCount === 1 ? "Approve Additional Work" : "Approve All Additional Work"}
        </button>
        <button className="min-h-14 rounded-xl border border-[#777] bg-white px-5 font-ui text-base font-bold text-[#333] disabled:opacity-60" disabled={busy !== null} onClick={() => respond("decline")} type="button">
          {busy === "decline" ? "Recording response..." : "Decline and Contact Me"}
        </button>
      </div>
    </section>
  );
}
