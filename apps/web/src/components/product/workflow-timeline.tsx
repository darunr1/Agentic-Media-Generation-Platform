"use client";
import { useEffect, useState } from "react";
import { Badge, Card, CardContent } from "@contentforge/ui";
import { ActionButton } from "./workflow-actions";

export interface RunView {
  id: string;
  status: string;
  totalCostCents: number;
  errorMessage: string | null;
  contentItemId: string | null;
  steps: Array<{
    id: string;
    name: string;
    status: string;
    provider: string | null;
    model: string | null;
    costCents: number;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
    output: unknown;
  }>;
  tasks: Array<{
    id: string;
    type: string;
    status: string;
    attemptCount: number;
    maxAttempts: number;
    lastError: string | null;
  }>;
}
const terminal = ["SUCCEEDED", "FAILED", "DEAD_LETTER", "CANCELLED"];
export function WorkflowTimeline({
  workspaceSlug,
  initial,
  canCancel,
}: {
  workspaceSlug: string;
  initial: RunView;
  canCancel: boolean;
}) {
  const [run, setRun] = useState(initial),
    [error, setError] = useState("");
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(
          `/api/v1/workspaces/${workspaceSlug}/workflows/${initial.id}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Progress temporarily unavailable; reconnecting…");
        const result = (await response.json()) as { data: RunView };
        if (disposed) return;
        setRun(result.data);
        setError("");
        failures = 0;
        if (terminal.includes(result.data.status)) return;
      } catch (e) {
        if (disposed) return;
        failures++;
        setError(e instanceof Error ? e.message : "Reconnecting…");
      }
      if (!disposed)
        timer = setTimeout(
          () => void poll(),
          document.hidden ? 15000 : Math.min(30000, 2000 * 2 ** failures),
        );
    }
    if (!terminal.includes(initial.status)) void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [initial.id, initial.status, workspaceSlug]);
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <Badge>{run.status}</Badge>
        <span className="text-muted-foreground text-sm">
          Recorded estimate: ${(run.totalCostCents / 100).toFixed(2)}
        </span>
        {canCancel && !terminal.includes(run.status) && (
          <ActionButton
            url={`/api/v1/workspaces/${workspaceSlug}/workflows/${run.id}`}
            method="DELETE"
          >
            Cancel workflow
          </ActionButton>
        )}
      </div>
      {error && <p role="status">{error}</p>}
      {run.errorMessage && (
        <p role="alert" className="text-destructive">
          {run.errorMessage}
        </p>
      )}
      {run.steps.map((step) => (
        <Card key={step.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{step.name}</strong>
              <Badge variant={step.status === "SUCCEEDED" ? "success" : "outline"}>
                {step.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {step.provider ?? "Pending provider"} · {step.model ?? "—"}
              {step.startedAt && step.completedAt
                ? ` · ${((Date.parse(step.completedAt) - Date.parse(step.startedAt)) / 1000).toFixed(1)}s`
                : ""}
            </p>
            {step.errorMessage && <p role="alert">{step.errorMessage}</p>}
            <details>
              <summary className="cursor-pointer text-sm">Structured output and usage</summary>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      ))}
      <div className="rounded-xl border p-4">
        <p className="mb-2 font-medium">Durable tasks</p>
        {run.tasks.map((task) => (
          <p key={task.id} className="text-muted-foreground text-sm">
            {task.type} · {task.status} · attempt {task.attemptCount}/{task.maxAttempts}
            {task.lastError ? ` · ${task.lastError}` : ""}
          </p>
        ))}
      </div>
      {run.status === "SUCCEEDED" && (
        <p role="status">
          {run.contentItemId ? (
            <a
              className="text-primary underline"
              href={`/w/${workspaceSlug}/studio?contentId=${run.contentItemId}`}
            >
              Open content in the studio
            </a>
          ) : (
            <a className="text-primary underline" href={`/w/${workspaceSlug}/campaigns`}>
              View campaign results
            </a>
          )}
        </p>
      )}
    </div>
  );
}
