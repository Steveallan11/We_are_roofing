"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  customerId: string;
  customerName: string;
  jobCount: number;
};

export function DeleteCustomerAction({ customerId, customerName, jobCount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expected = customerName || "DELETE";
  const canDelete = confirmText.trim() === expected || confirmText.trim().toUpperCase() === "DELETE";

  async function deleteCustomer() {
    setError(null);
    const response = await fetch(`/api/customers/${customerId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: confirmText })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Customer could not be deleted.");
      return;
    }
    startTransition(() => {
      router.push("/customers");
      router.refresh();
    });
  }

  if (!expanded) {
    return (
      <button className="button-ghost w-full !border-[#6b1f1f] !text-[#ff9a91]" onClick={() => setExpanded(true)} type="button">
        Delete Test Customer
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[#6b1f1f] bg-[rgba(120,20,20,0.12)] p-4">
      <p className="font-semibold text-[#ffb3ad]">Delete this customer permanently?</p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        This removes the customer plus {jobCount} linked job{jobCount === 1 ? "" : "s"} and related files. Type{" "}
        <span className="font-semibold text-white">{expected}</span> to confirm.
      </p>
      <input className="field mt-3 !border-[#6b1f1f]" onChange={(event) => setConfirmText(event.target.value)} placeholder={expected} value={confirmText} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="button-ghost !px-3 !py-2 text-sm" onClick={() => setExpanded(false)} type="button">
          Cancel
        </button>
        <button
          className="button-secondary !border-[#b33b33] !bg-[rgba(180,40,40,0.24)] !px-3 !py-2 text-sm !text-[#ffb3ad]"
          disabled={!canDelete || isPending}
          onClick={deleteCustomer}
          type="button"
        >
          {isPending ? "Deleting..." : "Delete Permanently"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}
