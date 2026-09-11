import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@contentforge/ui";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="from-primary to-accent text-primary-foreground flex size-8 items-center justify-center rounded-lg bg-gradient-to-br">
            <Sparkles className="size-4" />
          </span>
          ContentForge
        </Link>
        <nav className="text-muted-foreground hidden items-center gap-6 text-sm sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Start free trial</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
