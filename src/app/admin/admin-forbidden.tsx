import Link from "next/link";

export default function AdminForbidden() {
  return <main className="page"><p className="eyebrow">403 · FORBIDDEN</p><h1>관리자 권한이 필요합니다</h1><p>이 페이지는 관리자 계정만 이용할 수 있습니다.</p><Link className="primary inline-link" href="/dashboard">대시보드로 돌아가기</Link></main>;
}
