"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@contentforge/ui";

// Keep server-rendered actions disabled until their client handlers are attached.
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export async function mutate(
  url: string,
  method: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = (await response.json()) as {
    data?: Record<string, unknown>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(result.error?.message ?? "Request failed");
  return result.data ?? {};
}
export function ActionButton({
  url,
  method = "POST",
  body,
  children,
  redirect,
  disabled = false,
}: {
  url: string;
  method?: string;
  body?: Record<string, unknown>;
  children: React.ReactNode;
  redirect?: string;
  disabled?: boolean;
}) {
  const hydrated = useHydrated();
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [key, setKey] = useState<string>();
  return (
    <span className="inline-flex flex-col gap-2">
      <Button
        disabled={!hydrated || busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          const idempotencyKey = key ?? crypto.randomUUID();
          setKey(idempotencyKey);
          try {
            const result = await mutate(
              url,
              method,
              method === "DELETE"
                ? undefined
                : { ...body, ...(url.includes("generations") ? { idempotencyKey } : {}) },
            );
            if (redirect) router.push(redirect.replace(":id", String(result.id)));
            else if (url.includes("generations"))
              router.push(
                url.split("/api/v1/workspaces/")[1]
                  ? `/w/${url.split("/api/v1/workspaces/")[1]!.split("/")[0]}/workflows/${result.id}`
                  : "/app",
              );
            else router.refresh();
            setKey(undefined);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Request failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : children}
      </Button>
      {error && (
        <span role="alert" className="text-destructive text-sm">
          {error}
        </span>
      )}
    </span>
  );
}

export interface FormField {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}
export function RecordForm({
  url,
  fields,
  initial = {},
  label,
  method = "POST",
  arrays = [],
}: {
  url: string;
  fields: FormField[];
  initial?: Record<string, string>;
  label: string;
  method?: string;
  arrays?: string[];
}) {
  const hydrated = useHydrated();
  const router = useRouter(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess(false);
    const data: Record<string, unknown> = Object.fromEntries(new FormData(event.currentTarget));
    for (const key of arrays)
      data[key] = String(data[key] ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    if (url.includes("brands")) {
      data.guidelines = String(data.guidelines ?? "")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf("|");
          return separator > 0
            ? { type: line.slice(0, separator).trim(), content: line.slice(separator + 1).trim() }
            : { type: "COMPLIANCE_NOTE", content: line };
        });
    }
    try {
      await mutate(url, method, data);
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className="space-y-2 text-sm">
            <span>{field.label}</span>
            {field.options ? (
              <select
                name={field.name}
                defaultValue={initial[field.name]}
                required={field.required ?? true}
                className="bg-background w-full rounded-md border p-2"
              >
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <Textarea
                name={field.name}
                defaultValue={initial[field.name] ?? ""}
                required={field.required ?? true}
                maxLength={5000}
              />
            ) : (
              <Input
                type={field.type ?? "text"}
                name={field.name}
                defaultValue={initial[field.name] ?? ""}
                required={field.required ?? true}
              />
            )}
          </label>
        ))}
      </div>
      <Button disabled={!hydrated || busy}>{busy ? "Saving…" : label}</Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm">
          Saved.
        </p>
      )}
    </form>
  );
}

export function ReviewActions({
  workspaceSlug,
  requestId,
}: {
  workspaceSlug: string;
  requestId: string;
}) {
  const hydrated = useHydrated();
  const router = useRouter(),
    [notes, setNotes] = useState(""),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="mt-4 space-y-3">
      <label className="block text-sm">
        Review comments
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={!hydrated}
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        I reviewed the content and acknowledge compliance.
      </label>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["APPROVED", "Approve"],
            ["CHANGES_REQUESTED", "Request changes"],
            ["REJECTED", "Reject"],
          ] as const
        ).map(([decision, label]) => (
          <Button
            key={decision}
            variant={decision === "APPROVED" ? "default" : "outline"}
            disabled={!hydrated || busy || (decision === "APPROVED" && !ack)}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await mutate(`/api/v1/workspaces/${workspaceSlug}/approvals`, "POST", {
                  approvalRequestId: requestId,
                  decision,
                  notes,
                  complianceAcknowledged: ack,
                });
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Review failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function ScheduleForm({
  workspaceSlug,
  contentId,
  accounts,
}: {
  workspaceSlug: string;
  contentId: string;
  accounts: Array<{ id: string; displayName: string }>;
}) {
  const hydrated = useHydrated();
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [key] = useState(() => crypto.randomUUID());
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await mutate(`/api/v1/workspaces/${workspaceSlug}/publishing`, "POST", {
            contentItemId: contentId,
            socialAccountId: data.get("account"),
            scheduledAt: data.get("when")
              ? new Date(String(data.get("when"))).toISOString()
              : new Date().toISOString(),
            idempotencyKey: key,
          });
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Scheduling failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        Destination
        <select
          name="account"
          className="bg-background mt-1 block w-full rounded border p-2"
          required
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName} · Mock
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Schedule in your local time (leave empty to publish now)
        <Input type="datetime-local" name="when" />
      </label>
      <Button disabled={!hydrated || busy || !accounts.length}>
        {busy ? "Scheduling…" : "Schedule approved content"}
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
