"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button, toast } from "@contentforge/ui";

export function RevokeInvitationButton({
  workspaceSlug,
  invitationId,
}: {
  workspaceSlug: string;
  invitationId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function revoke() {
    setPending(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceSlug}/invitations/${invitationId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message ?? "Could not revoke invitation");
        return;
      }
      toast.success("Invitation revoked");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={revoke}>
      Revoke
    </Button>
  );
}
