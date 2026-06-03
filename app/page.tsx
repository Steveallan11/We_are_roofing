import type { Route } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();
  redirect((session ? "/today" : "/login") as Route);
}
