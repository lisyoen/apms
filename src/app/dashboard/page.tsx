import{redirect}from"next/navigation";import{currentUser}from"@/lib/auth";import AppShell from"@/components/AppShell";import DashboardClient from"./dashboard-client";
export default async function DashboardPage(){const user=await currentUser();if(!user)redirect("/login");return <AppShell email={user.email} displayName={user.display_name} role={user.role}><DashboardClient/></AppShell>}
