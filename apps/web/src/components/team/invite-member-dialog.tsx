"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@contentforge/ui";

const formSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(["ADMIN", "EDITOR", "REVIEWER", "VIEWER"]),
});
type FormValues = z.infer<typeof formSchema>;

export function InviteMemberDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", role: "EDITOR" },
  });

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceSlug}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message ?? "Could not send invitation");
        return;
      }
      toast.success(`Invitation sent to ${values.email}`);
      form.reset({ email: "", role: "EDITOR" });
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@business.com"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              defaultValue={form.getValues("role")}
              onValueChange={(value) => form.setValue("role", value as FormValues["role"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin — full operational control</SelectItem>
                <SelectItem value="EDITOR">Editor — create and edit content</SelectItem>
                <SelectItem value="REVIEWER">Reviewer — approve or reject content</SelectItem>
                <SelectItem value="VIEWER">Viewer — read only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
