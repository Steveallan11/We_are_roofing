import Link from "next/link";
import { getJobs } from "@/lib/data";
import { KanbanBoard } from "@/components/crm/kanban-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const jobs = await getJobs();
  return (
    <div className="p-4 sm:p-6 max-w-[100vw] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-condensed text-3xl text-white">Pipeline</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Drag jobs between columns to update status</p>
        </div>
        <Link className="button-primary text-sm" href="/leads/new">+ Add Lead</Link>
      </div>
      <KanbanBoard initialJobs={jobs as any} />
    </div>
  );
}
