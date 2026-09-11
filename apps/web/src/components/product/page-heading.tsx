export function PageHeading({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description: string;
  eyebrow?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-primary text-xs font-semibold uppercase tracking-[0.18em]">
        {eyebrow ?? "ContentForge"}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground max-w-3xl text-sm leading-6">{description}</p>
    </div>
  );
}
