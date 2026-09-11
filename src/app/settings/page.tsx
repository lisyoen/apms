import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof Response && error.status === 401) redirect("/login");
    throw error;
  }

  return <AppShell email={user.email} displayName={user.display_name} role={user.role}><SettingsClient /></AppShell>;
}
