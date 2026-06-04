"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { NurtureSequence, NurtureEmail } from "@/lib/types";

type Props = {
  quoteId: string;
};

export function NurtureSequenceStatus({ quoteId }: Props) {
  const [sequence, setSequence] = useState<NurtureSequence | null>(null);
  const [emails, setEmails] = useState<NurtureEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSequence = async () => {
    try {
      const res = await fetch(`/api/nurture/status?quoteId=${quoteId}`);
      if (res.ok) {
        const data = await res.json();
        setSequence(data.sequence);
        setEmails(data.emails);
      }
    } catch (err) {
      console.error("Failed to load nurture sequence:", err);
    }
  };

  useEffect(() => {
    loadSequence().finally(() => setLoading(false));
  }, [quoteId]);

  const handleStartSequence = async () => {
    setIsManaging(true);
    setError(null);
    try {
      const res = await fetch("/api/nurture/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", quoteId })
      });

      if (res.ok) {
        await loadSequence();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to start sequence");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsManaging(false);
    }
  };

  const handleCancelSequence = async () => {
    if (!confirm("Cancel nurture sequence? This will stop follow-up emails.")) return;

    setIsManaging(true);
    setError(null);
    try {
      const res = await fetch("/api/nurture/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", quoteId })
      });

      if (res.ok) {
        await loadSequence();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to cancel sequence");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsManaging(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[var(--muted)]">Loading nurture status...</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return "text-green-500";
      case "opened":
      case "clicked":
        return "text-blue-500";
      case "failed":
      case "bounced":
        return "text-red-500";
      default:
        return "text-[var(--muted)]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return "✓";
      case "delivered":
        return "✓✓";
      case "opened":
        return "👁️";
      case "clicked":
        return "🔗";
      case "failed":
      case "bounced":
        return "✗";
      default:
        return "⏳";
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text)]">
          Follow-up Sequence
        </h4>
        {sequence ? (
          !sequence.completed_at && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelSequence}
              disabled={isManaging}
            >
              Cancel
            </Button>
          )
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartSequence}
            disabled={isManaging}
          >
            Start Sequence
          </Button>
        )}
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-500">{error}</p>
      )}

      {!sequence ? (
        <p className="text-sm text-[var(--muted)]">
          No sequence started yet. Click "Start Sequence" to begin follow-ups.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {emails.map((email) => (
              <div key={email.id} className="flex items-start justify-between rounded-lg bg-black/30 p-3">
                <div className="flex-1">
                  <p className="text-xs text-[var(--muted)]">Day {email.day_number}</p>
                  <p className="text-sm text-[var(--text)]">{email.subject}</p>
                  {email.sent_at && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Sent {new Date(email.sent_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className={`ml-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-lg ${getStatusColor(email.status)}`}>
                  {getStatusIcon(email.status)}
                </div>
              </div>
            ))}
          </div>

          {sequence.completed_at && (
            <p className="mt-3 text-xs italic text-[var(--muted)]">
              Sequence {sequence.completion_reason === "manually_cancelled" ? "cancelled" : "completed"} on {new Date(sequence.completed_at).toLocaleDateString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
