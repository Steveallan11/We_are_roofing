import type { Metadata } from "next";
import "@/app/globals.css";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "We Are Roofing OS",
  description: "Mobile-first roofing survey, quote, and job workflow."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
            {children}
            <AssistantPanel />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
