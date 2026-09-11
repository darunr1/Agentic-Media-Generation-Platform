import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@contentforge/ui";

export default function NotFound() {
  return (
    <div className="bg-grid-pattern flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full">
        <FileQuestion className="size-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Either this page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Button asChild>
        <Link href="/app">Back to dashboard</Link>
      </Button>
    </div>
  );
}
