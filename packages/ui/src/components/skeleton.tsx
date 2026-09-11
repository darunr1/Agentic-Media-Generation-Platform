import * as React from "react";

import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-secondary/60 animate-pulse rounded-md", className)}
      role="status"
      aria-label="Loading"
      {...props}
    />
  );
}
