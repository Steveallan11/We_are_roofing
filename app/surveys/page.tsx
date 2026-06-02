import { redirect } from "next/navigation";
import type { Route } from "next";

export default function SurveysPage() {
  redirect("/jobs?filter=survey" as Route);
}
