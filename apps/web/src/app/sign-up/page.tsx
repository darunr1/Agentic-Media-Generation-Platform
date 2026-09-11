import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Start your free trial" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Start your free trial"
      description="Enter your email and we'll send a secure link to create your account. No credit card required."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="bg-secondary/40 h-48 animate-pulse rounded-lg" />}>
        <SignInForm mode="sign-up" />
      </Suspense>
    </AuthCard>
  );
}
