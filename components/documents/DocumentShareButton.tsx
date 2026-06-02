"use client";

import { useState } from "react";
import type { JobDocumentRecord } from "@/lib/types";

type ShareRecord = {
  id: string;
  share_token: string;
  created_at: string;
  expires_at: string | null;
  access_count: number;
  is_active: boolean;
};

type Props = {
  jobId: string;
  documentId: string;
  documentName: string;
};

export function DocumentShareButton({ jobId, documentId, documentName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expiresDay, setExpiresDay] = useState<number>(30);

  const handleOpenShare = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" })
      });

      const result = await response.json();
      if (result.ok) {
        setShares(result.data || []);
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Error fetching shares:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateShare = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expires_days: expiresDay })
      });

      const result = await response.json();
      if (result.ok) {
        setShares([result.data, ...shares]);
        // Copy link to clipboard
        const shareUrl = result.data.share_url || `${window.location.origin}/share/${result.data.share_token}`;
        await navigator.clipboard.writeText(shareUrl);
        alert("Share link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error creating share:", error);
      alert("Failed to create share link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm("Revoke this share link?")) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" })
      });

      if (response.ok) {
        setShares(shares.filter((s) => s.id !== shareId));
      }
    } catch (error) {
      console.error("Error revoking share:", error);
    }
  };

  const copyToClipboard = async (token: string) => {
    const shareUrl = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(shareUrl);
    alert("Share link copied to clipboard!");
  };

  return (
    <>
      <button
        className="text-xs text-[var(--gold)] hover:underline transition disabled:opacity-50"
        onClick={handleOpenShare}
        disabled={isLoading}
        type="button"
      >
        {isLoading ? "Loading..." : "Share"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div
            className="fixed bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--surface)] p-5 md:right-auto md:w-96 md:rounded-2xl md:border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-kicker text-[0.65rem] uppercase">Share Document</p>
                <h3 className="mt-2 font-condensed text-2xl text-white">{documentName}</h3>
              </div>
              <button
                className="button-ghost !px-3 !py-2 text-sm"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Create New Share */}
              <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
                <p className="text-xs font-bold uppercase text-[var(--dim)]">Create New Share Link</p>
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="text-xs text-[var(--muted)]">Expires in (days)</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={expiresDay}
                      onChange={(e) => setExpiresDay(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-[var(--border)] bg-black/20 px-3 py-2 text-sm text-white placeholder-[var(--text-faint)]"
                    />
                  </div>
                  <button
                    onClick={handleCreateShare}
                    disabled={isLoading}
                    className="w-full rounded bg-[var(--gold)] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[var(--gold-l)] disabled:opacity-50"
                    type="button"
                  >
                    {isLoading ? "Creating..." : "Create Share Link"}
                  </button>
                </div>
              </div>

              {/* Existing Shares */}
              {shares.length > 0 ? (
                <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
                  <p className="text-xs font-bold uppercase text-[var(--dim)]">Active Share Links</p>
                  <div className="mt-3 space-y-2">
                    {shares.map((share) => (
                      <div key={share.id} className="rounded border border-[var(--border)]/50 bg-black/20 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-xs text-[var(--muted)]">{share.share_token.slice(0, 16)}...</p>
                            <div className="mt-1 flex flex-wrap gap-1 text-[0.65rem] text-[var(--text-faint)]">
                              {share.access_count > 0 && <span>{share.access_count} views</span>}
                              {share.expires_at && (
                                <span>Expires {new Date(share.expires_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => copyToClipboard(share.share_token)}
                            className="shrink-0 text-xs text-[var(--gold)] hover:underline"
                            type="button"
                          >
                            Copy
                          </button>
                        </div>
                        <button
                          onClick={() => handleRevokeShare(share.id)}
                          className="mt-2 w-full text-xs text-red-500 hover:text-red-400"
                          type="button"
                        >
                          Revoke Access
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">No active share links. Create one to share this document with your customer.</p>
              )}

              <p className="text-[0.65rem] text-[var(--text-faint)]">Share links can be accessed without login. Anyone with the link can view and download the document.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
