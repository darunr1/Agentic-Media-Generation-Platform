"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { cn } from "@contentforge/ui";

import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}`;

  return (
    <aside className="border-border/60 bg-card/40 hidden w-60 shrink-0 flex-col border-r lg:flex">
      <div className="border-border/60 flex h-16 items-center gap-2 border-b px-5 font-semibold tracking-tight">
        <span className="from-primary to-accent text-primary-foreground flex size-7 items-center justify-center rounded-lg bg-gradient-to-br">
          <Sparkles className="size-3.5" />
        </span>
        ContentForge
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const href = `${base}/${item.href}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
