"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  toast,
} from "@contentforge/ui";

export function DangerZone({
  workspaceSlug,
  workspaceName,
}: {
  workspaceSlug: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function deleteWorkspace() {
    setPending(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceSlug}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message ?? "Could not delete workspace");
        return;
      }
      toast.success("Workspace deleted");
      router.push("/app");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete workspace</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {workspaceName}?</DialogTitle>
          <DialogDescription>
            This immediately revokes access for every member. Data is retained for a grace period
            before permanent deletion. This cannot be undone from the UI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-name">Type the workspace name to confirm</Label>
          <Input
            id="confirm-name"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={confirmation !== workspaceName}
            loading={pending}
            onClick={deleteWorkspace}
          >
            Delete workspace permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
