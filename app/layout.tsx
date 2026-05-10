import type { Metadata } from "next";
import { NavShell } from "@/components/layout/nav-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "We Are Roofing OS",
  description: "Business management system for We Are Roofing UK Ltd",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body><NavShell>{children}</NavShell></body>
    </html>
  );
}
