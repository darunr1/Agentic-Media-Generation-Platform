import "@contentforge/ui/globals.css";

import type { Metadata } from "next";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "ContentForge — AI content, made for small business",
    template: "%s · ContentForge",
  },
  description:
    "ContentForge turns a brand profile into a monthly content strategy, scripts, renders, and scheduled posts — with a human approval queue on every publish.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
