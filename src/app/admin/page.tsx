import { redirect } from "next/navigation";import { currentUser } from "@/lib/auth";import AdminShell from "./admin-shell";
export default async function AdminPage(){const u=await currentUser();if(!u)redirect("/login");if(u.role!=="admin")return <main style={{padding:40}}><h1>403</h1><p>관리자 권한이 필요합니다.</p></main>;return <AdminShell/>}
