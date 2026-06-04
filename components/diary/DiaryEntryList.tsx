import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DiaryEntry, DiaryEntryType } from "@/lib/types";

type Props = {
  entryType?: DiaryEntryType | null;
  refreshTrigger?: number;
};

export async function DiaryEntryList({ entryType, refreshTrigger }: Props) {
  const supabase = createSupabaseAdminClient();

  let query = supabase.from("diary_entries").select("*").order("created_at", { ascending: false }).limit(50);

  if (entryType) {
    query = query.eq("entry_type", entryType);
  }

  const { data: entries, error } = await query;

  if (error || !entries) {
    return <p className="text-sm text-[var(--text-muted)]">No entries yet. Start capturing!</p>;
  }

  if (entries.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No {entryType ? entryType.replace("_", " ") : ""} entries yet.</p>;
  }

  return (
    <div className="space-y-2">
      {(entries as DiaryEntry[]).map((entry) => (
        <DiaryEntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function DiaryEntryCard({ entry }: { entry: DiaryEntry }) {
  const date = new Date(entry.created_at).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const typeIcon: Record<string, string> = {
    voice_note: "🎤",
    text_note: "📝",
    photo: "📸",
    reminder: "⏰",
    task: "✓",
    expense: "💷",
    payment: "💳"
  };

  const icon = typeIcon[entry.entry_type] || "•";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          <span className="text-xl">{icon}</span>
          <div className="min-w-0">
            {entry.title && <p className="font-semibold text-[var(--text)]">{entry.title}</p>}
            {entry.body && <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-2">{entry.body}</p>}
            {entry.entry_type === "task" && entry.task_due_date && (
              <p className="mt-1 text-xs text-[#f59e0b]">Due: {new Date(entry.task_due_date).toLocaleDateString("en-GB")}</p>
            )}
            {entry.entry_type === "expense" && entry.expense_amount && (
              <p className="mt-1 text-xs text-[#ef4444]">£{entry.expense_amount.toFixed(2)}</p>
            )}
            {entry.entry_type === "payment" && entry.payment_amount && (
              <p className="mt-1 text-xs text-[#6366f1]">£{entry.payment_amount.toFixed(2)} to {entry.payment_to_name}</p>
            )}
          </div>
        </div>
        <span className="shrink-0 text-xs text-[var(--text-muted)]">{date}</span>
      </div>
    </div>
  );
}
