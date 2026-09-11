import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="We'll email you a secure sign-in link — no password to remember."
      footer={
        <>
          New to ContentForge?{" "}
          <Link href="/sign-up" className="text-primary hover:underline">
            Start a free trial
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="bg-secondary/40 h-48 animate-pulse rounded-lg" />}>
        <SignInForm mode="sign-in" />
      </Suspense>
    </AuthCard>
  );
}
