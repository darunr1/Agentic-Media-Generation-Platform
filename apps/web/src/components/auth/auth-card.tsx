import Link from "next/link";
import { Sparkles } from "lucide-react";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-grid-pattern flex min-h-screen items-center justify-center px-4 py-16">
      <div className="border-border bg-card w-full max-w-sm space-y-6 rounded-xl border p-8 shadow-lg">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 font-semibold tracking-tight"
        >
          <span className="from-primary to-accent text-primary-foreground flex size-8 items-center justify-center rounded-lg bg-gradient-to-br">
            <Sparkles className="size-4" />
          </span>
          ContentForge
        </Link>
        <div className="space-y-1.5 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {children}
        {footer ? <div className="text-muted-foreground text-center text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
