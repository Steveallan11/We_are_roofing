"use client";

import { useEffect, useState } from "react";
import { QuickDiaryEntry } from "./QuickDiaryEntry";

type Props = {
  isOpen: boolean;
  jobId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function QuickCaptureModal({ isOpen, jobId, onClose, onSuccess }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen || !jobId) return null;

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center">
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-4 sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text)]">Quick Log</h3>
          <button
            onClick={onClose}
            className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>
        <QuickDiaryEntry jobId={jobId} onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
