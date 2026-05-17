import { redirect } from "next/navigation";
import type { Route } from "next";

export default function CrmPage() {
  redirect("/jobs" as Route);
}
