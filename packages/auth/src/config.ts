import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@contentforge/database";
import { createEmailProviderFromEnv, loadEnv } from "@contentforge/shared";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Email from "next-auth/providers/email";

/**
 * Auth.js (next-auth v5) configuration.
 *
 * Production sign-in is passwordless email (brief §3: "Email/passwordless or
 * social sign-in"). It's wired through our own EmailProvider abstraction —
 * console-logged locally, pluggable to Resend — instead of nodemailer, so
 * the demo needs zero SMTP credentials.
 *
 * A second, `dev-login` Credentials provider exists *only* when
 * `NODE_ENV !== "production"`. It signs a user in by email with no password
 * check at all, which is deliberately unsafe — it exists purely so the
 * seeded demo user and Playwright e2e tests can authenticate without
 * reading a magic link out of console output. It is hard-gated in code
 * (not just by an env flag) so it cannot ship active in a production build.
 */
export function buildAuthConfig(): NextAuthConfig {
  const env = loadEnv();
  const emailProvider = createEmailProviderFromEnv(env);
  const isProduction = env.NODE_ENV === "production";

  return {
    adapter: PrismaAdapter(prisma),
    secret: env.AUTH_SECRET,
    trustHost: env.AUTH_TRUST_HOST,
    session: { strategy: "jwt" },
    pages: {
      signIn: "/sign-in",
      verifyRequest: "/sign-in/check-email",
      error: "/sign-in",
    },
    providers: [
      Email({
        from: env.EMAIL_FROM,
        // Auth.js' Email provider validates this shape even when delivery is
        // fully overridden below. It is never contacted.
        server: { host: "localhost", port: 25 },
        sendVerificationRequest: async ({ identifier, url }) => {
          await emailProvider.send({
            to: identifier,
            subject: "Sign in to ContentForge",
            text: `Sign in to ContentForge by opening this link:\n\n${url}\n\nThis link expires in 24 hours. If you didn't request this, you can ignore this email.`,
            html: `<p>Sign in to ContentForge by clicking the link below.</p><p><a href="${url}">Sign in to ContentForge</a></p><p>This link expires in 24 hours. If you didn't request this, you can ignore this email.</p>`,
            tag: "auth-magic-link",
          });
        },
      }),
      ...(isProduction
        ? []
        : [
            Credentials({
              id: "dev-login",
              name: "Development sign-in (no password)",
              credentials: { email: { label: "Email", type: "email" } },
              async authorize(credentials) {
                if (process.env.NODE_ENV === "production") return null;
                const email =
                  typeof credentials?.email === "string" ? credentials.email : undefined;
                if (!email) return null;
                const user = await prisma.user.findUnique({ where: { email } });
                if (!user) return null;
                return {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  image: user.image,
                };
              },
            }),
          ]),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user?.id) {
          token.sub = user.id;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub;
        }
        return session;
      },
    },
  };
}
