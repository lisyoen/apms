import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://apms.craftbay.io"),
  title: "APMS - Agentic Project Management System",
  description: "에이전트와 함께 프로젝트를 계획하고 실행하는 관리 시스템입니다.",
  openGraph: { title: "APMS - Agentic Project Management System", description: "에이전트와 함께 프로젝트를 계획하고 실행하는 관리 시스템입니다.", url: "https://apms.craftbay.io", images: [{ url: "/og.png", width: 1200, height: 630 }], type: "website" },
  twitter: { card: "summary_large_image", title: "APMS - Agentic Project Management System", description: "에이전트와 함께 프로젝트를 계획하고 실행하는 관리 시스템입니다.", images: ["/og.png"] },
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/favicon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
