import type { Metadata } from "next";
import { MailCheck } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthCard
      title="Check your email"
      description={
        email
          ? `We sent a sign-in link to ${email}. In local development it's printed to the server console instead of a real inbox.`
          : "We sent you a sign-in link. In local development it's printed to the server console instead of a real inbox."
      }
    >
      <div className="text-primary flex justify-center py-4">
        <MailCheck className="size-10" />
      </div>
    </AuthCard>
  );
}
