import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "We Are Roofing OS",
  description: "Mobile-first roofing survey, quote, and job workflow."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
