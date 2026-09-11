import { cn } from "@contentforge/ui";
export function StatusDot({ active = true }: { active?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 rounded-full",
        active ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.65)]" : "bg-amber-400",
      )}
    />
  );
}
