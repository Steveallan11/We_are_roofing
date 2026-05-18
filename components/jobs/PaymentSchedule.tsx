"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Job, PaymentScheduleRecord, QuoteRecord } from "@/lib/types";
import { currency } from "@/lib/utils";

const TEMPLATES = ["50/50 Standard", "30/70 Split", "3-Stage"];

export function PaymentSchedule({ job, quote, initialSchedule }: { job: Job; quote?: QuoteRecord | null; initialSchedule?: PaymentScheduleRecord | null }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(initialSchedule ?? null);
  const [template, setTemplate] = useState("50/50 Standard");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!quote || !["Accepted", "Materials Needed", "Materials Ordered", "Booked", "Scaffold In Situ", "In Progress", "Completed"].includes(job.status)) return null;

  async function createSchedule() {
    setError(null);
    const response = await fetch(`/api/jobs/${job.id}/payment-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; schedule?: PaymentScheduleRecord } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Payment schedule could not be created.");
      return;
    }
    setSchedule(result.schedule ?? null);
    setMessage("Payment schedule created.");
    startTransition(() => router.refresh());
  }

  async function stageAction(stageId: string, action: "invoice" | "paid") {
    setError(null);
    const response = await fetch(`/api/jobs/${job.id}/payment-schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_id: stageId, action })
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Payment stage could not be updated.");
      return;
    }
    setMessage(action === "invoice" ? "Invoice raised for payment stage." : "Payment stage marked paid.");
    startTransition(() => router.refresh());
  }

  const stages = schedule?.stages ?? [];
  const total = stages.reduce((sum, stage) => sum + Number(stage.amount ?? 0), 0);

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-kicker text-[0.65rem] uppercase">Stage Payments</p>
          <h2 className="mt-2 font-display text-3xl text-white">Payment schedule</h2>
        </div>
        {!schedule ? (
          <div className="flex flex-wrap gap-3">
            <select className="field min-h-11 w-48" onChange={(event) => setTemplate(event.target.value)} value={template}>
              {TEMPLATES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <button className="button-primary" disabled={isPending} onClick={createSchedule} type="button">
              Set Up Schedule
            </button>
          </div>
        ) : null}
      </div>
      {schedule ? (
        <div className="mt-5 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>%</th>
                <th>Amount</th>
                <th>Due</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.id}>
                  <td>{stage.stage_name}</td>
                  <td>{stage.percentage}%</td>
                  <td>{currency(Number(stage.amount ?? 0))}</td>
                  <td>{formatTrigger(stage.due_trigger)}</td>
                  <td>{stage.status}</td>
                  <td>
                    {stage.status === "pending" ? (
                      <button className="button-ghost !px-3 !py-1 text-xs" onClick={() => stageAction(stage.id, "invoice")} type="button">
                        Raise Invoice
                      </button>
                    ) : null}
                    {stage.status === "invoiced" ? (
                      <button className="button-ghost !px-3 !py-1 text-xs" onClick={() => stageAction(stage.id, "paid")} type="button">
                        Mark Paid
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td />
                <td>{currency(total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">Choose a template to split the accepted quote into deposit and balance stages.</p>
      )}
      {message ? <p className="mt-4 text-sm text-[#7ce3a6]">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#ff9a91]">{error}</p> : null}
    </div>
  );
}

function formatTrigger(value?: string | null) {
  if (value === "on_acceptance") return "On acceptance";
  if (value === "on_start") return "On start";
  if (value === "on_completion") return "On completion";
  return "Custom";
}
