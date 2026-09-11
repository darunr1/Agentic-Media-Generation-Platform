"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button, Input, Label, toast } from "@contentforge/ui";

export function RenameWorkspaceForm({
  workspaceSlug,
  initialName,
  disabled,
}: {
  workspaceSlug: string;
  initialName: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message ?? "Could not update workspace");
        return;
      }
      toast.success("Workspace updated");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-3">
      <div className="flex-1 space-y-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
        />
      </div>
      <Button type="submit" loading={pending} disabled={disabled || name.trim() === initialName}>
        Save
      </Button>
    </form>
  );
}
