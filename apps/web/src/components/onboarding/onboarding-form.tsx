"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, Input, Label, toast } from "@contentforge/ui";

const formSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters").max(80),
});
type FormValues = z.infer<typeof formSchema>;

export function OnboardingForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      const res = await fetch("/api/v1/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error?.message ?? "Could not create workspace");
        return;
      }
      router.push(`/w/${body.data.slug}/dashboard`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Business or workspace name</Label>
        <Input
          id="name"
          placeholder="Riverbend Coffee Roasters"
          autoFocus
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" loading={pending}>
        Create workspace
      </Button>
    </form>
  );
}
