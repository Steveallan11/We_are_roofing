import type { DiaryEntryType } from "@/lib/types";

export type DiaryTypeConfig = {
  label: string;
  icon: string;
  color: string;
  description: string;
};

export const DIARY_TYPE_CONFIG: Record<DiaryEntryType, DiaryTypeConfig> = {
  voice_note: { label: "Voice Note", icon: "🎤", color: "#3b82f6", description: "Speak your note" },
  text_note: { label: "Text Note", icon: "📝", color: "#8b5cf6", description: "Write a note" },
  photo: { label: "Photo", icon: "📸", color: "#10b981", description: "Capture image" },
  task: { label: "Task", icon: "✓", color: "#6366f1", description: "Add to-do" },
  reminder: { label: "Reminder", icon: "⏰", color: "#ec4899", description: "Set reminder" },
  expense: { label: "Expense", icon: "💷", color: "#06b6d4", description: "Log expense" },
  payment: { label: "Payment", icon: "💳", color: "#14b8a6", description: "Log payment" }
};

export const DIARY_TYPES: DiaryEntryType[] = [
  "voice_note",
  "text_note",
  "photo",
  "task",
  "reminder",
  "expense",
  "payment"
];

export function getDiaryColor(type: string): string {
  return DIARY_TYPE_CONFIG[type as DiaryEntryType]?.color ?? "var(--text-muted)";
}

export function getDiaryIcon(type: string): string {
  return DIARY_TYPE_CONFIG[type as DiaryEntryType]?.icon ?? "•";
}

export function getDiaryLabel(type: string): string {
  return DIARY_TYPE_CONFIG[type as DiaryEntryType]?.label ?? type.replace("_", " ");
}
