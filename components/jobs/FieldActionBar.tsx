"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

interface FieldModeAction {
  icon: string;
  label: string;
  action: () => void;
  color?: string;
}

interface FieldActionBarProps {
  jobId: string;
  showCamera?: boolean;
  showVoice?: boolean;
  showNote?: boolean;
  showTask?: boolean;
}

export function FieldActionBar({
  jobId,
  showCamera = true,
  showVoice = true,
  showNote = true,
  showTask = true,
}: FieldActionBarProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const actions: FieldModeAction[] = [];

  if (showCamera) {
    actions.push({
      icon: "📸",
      label: "Camera",
      action: () => {
        // Open camera/photo capture
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.capture = "environment";
        input.onchange = (e: any) => {
          if (e.target.files?.[0]) {
            // Handle photo upload
            console.log("Photo captured:", e.target.files[0]);
          }
        };
        input.click();
      },
      color: "bg-[#10b981]",
    });
  }

  if (showVoice) {
    actions.push({
      icon: "🎤",
      label: "Voice Note",
      action: () => {
        setIsRecording(!isRecording);
      },
      color: isRecording ? "bg-[#ef4444]" : "bg-[#3b82f6]",
    });
  }

  if (showNote) {
    actions.push({
      icon: "📝",
      label: "Quick Note",
      action: () => {
        router.push(`/jobs/${jobId}/quick-note` as Route);
      },
      color: "bg-[var(--gold)]",
    });
  }

  if (showTask) {
    actions.push({
      icon: "✓",
      label: "Create Task",
      action: () => {
        router.push(`/jobs/${jobId}/create-task` as Route);
      },
      color: "bg-[#f59e0b]",
    });
  }

  const handleKeyboardShortcut = useCallback((e: KeyboardEvent) => {
    // Alt+C for camera
    if (e.altKey && e.code === "KeyC") {
      e.preventDefault();
      actions[0]?.action();
    }
    // Alt+V for voice
    if (e.altKey && e.code === "KeyV") {
      e.preventDefault();
      actions[1]?.action();
    }
    // Alt+N for note
    if (e.altKey && e.code === "KeyN") {
      e.preventDefault();
      actions[2]?.action();
    }
  }, [actions]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [handleKeyboardShortcut]);

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {isExpanded && (
        <div className="mb-3 flex flex-col gap-2">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => {
                action.action();
                setIsExpanded(false);
              }}
              className={`${action.color || "bg-[#6366f1]"} text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center w-12 h-12`}
              title={action.label}
            >
              <span className="text-xl">{action.icon}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`${isRecording ? "bg-[#ef4444] animate-pulse" : "bg-[var(--gold)]"} text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center w-14 h-14 font-bold text-2xl`}
      >
        {isExpanded ? "×" : "+"}
      </button>

      {isRecording && (
        <div className="absolute bottom-20 right-4 bg-[#ef4444] text-white rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap">
          Recording...
        </div>
      )}

      <div className="absolute bottom-0 right-0 text-[10px] text-[var(--text-muted)] pointer-events-none whitespace-nowrap bg-[var(--surface)] rounded px-2 py-1">
        Alt+C/V/N
      </div>
    </div>
  );
}
