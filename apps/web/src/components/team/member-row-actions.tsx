"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import * as React from "react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@contentforge/ui";

export function MemberRowActions({
  workspaceSlug,
  membershipId,
}: {
  workspaceSlug: string;
  membershipId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function removeMember() {
    setPending(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceSlug}/members/${membershipId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message ?? "Could not remove member");
        return;
      }
      toast.success("Member removed");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={removeMember}
        >
          Remove from workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
