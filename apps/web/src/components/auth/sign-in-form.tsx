"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DEMO_USER_EMAIL } from "@contentforge/shared/constants";
import { Button, Input, Label } from "@contentforge/ui";

const formSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});
type FormValues = z.infer<typeof formSchema>;

const isDevLoginAvailable = process.env.NODE_ENV !== "production";

export function SignInForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/app";
  const [pending, setPending] = React.useState(false);
  const [devPending, setDevPending] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      await signIn("email", {
        email: values.email,
        callbackUrl,
        redirectTo: `/sign-in/check-email?email=${encodeURIComponent(values.email)}`,
      });
    } finally {
      setPending(false);
    }
  }

  async function continueAsDemoUser() {
    setDevPending(true);
    try {
      await signIn("dev-login", {
        email: DEMO_USER_EMAIL,
        redirectTo: callbackUrl,
      });
    } finally {
      setDevPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@business.com"
            autoComplete="email"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" loading={pending}>
          {mode === "sign-up" ? "Create your account" : "Send magic link"}
        </Button>
      </form>

      {isDevLoginAvailable ? (
        <div className="border-border bg-secondary/10 space-y-2 rounded-lg border border-dashed p-4">
          <p className="text-muted-foreground text-xs font-medium">
            Local demo shortcut (disabled in production)
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            loading={devPending}
            onClick={continueAsDemoUser}
          >
            Continue as seeded demo user
          </Button>
        </div>
      ) : null}
    </div>
  );
}
