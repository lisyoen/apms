"use client";
import Link from "next/link";
export default function AppShell({email,role,children}:{email:string;role:string;children:React.ReactNode}){async function logout(){await fetch("/api/auth/logout",{method:"POST"});location.href="/login"}return <><header className="topbar"><Link className="logo" href="/dashboard">APMS</Link><div className="top-actions">{role==="admin"&&<a className="admin-placeholder" href="#admin" title="#005에서 연결 예정">관리자</a>}<span>{email}</span><button className="text-button" onClick={logout}>로그아웃</button></div></header>{children}</>}
