import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dirigo.craftbay.io"),
  title: "Dirigo — AI-directed project management",
  description: "AI-directed project management",
  formatDetection: { telephone: false, email: false },
  openGraph: { title: "Dirigo — AI-directed project management", siteName: "Dirigo", description: "AI-directed project management", url: "https://dirigo.craftbay.io", images: [{ url: "/og.png", width: 1200, height: 630 }], type: "website" },
  twitter: { card: "summary_large_image", title: "Dirigo — AI-directed project management", description: "AI-directed project management", images: ["/og.png"] },
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/favicon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
