import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof Response && error.status === 401) redirect("/login");
    throw error;
  }

  return <AppShell email={user.email} displayName={user.display_name} role={user.role}><main className="page"><p className="eyebrow">ACCOUNT</p><h1>개인설정</h1><section className="settings-card" aria-labelledby="account-information"><h2 id="account-information">계정 정보</h2><dl className="settings-list"><dt>이메일</dt><dd>{user.email}</dd><dt>slug</dt><dd>{user.slug}</dd><dt>역할</dt><dd>{user.role}</dd><dt>표시 이름</dt><dd>{user.display_name||"—"}</dd></dl></section><p>#033 에서 편집·비밀번호 변경·환경설정·알림 제공 예정</p></main></AppShell>;
}
