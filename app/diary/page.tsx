import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/primitives";
import { DiaryClientWrapper } from "@/components/diary/DiaryClientWrapper";

export default function DiaryPage() {
  return (
    <AppShell
      title="Diary"
      subtitle="Capture voice notes, photos, tasks, expenses. Auto-linked to jobs."
      actions={
        <Button variant="ghost" size="md" asChild>
          <Link href={"/today" as Route}>Back</Link>
        </Button>
      }
    >
      <DiaryClientWrapper />
    </AppShell>
  );
}
