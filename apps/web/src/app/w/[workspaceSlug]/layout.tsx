import { notFound, redirect } from "next/navigation";

import { auth } from "@contentforge/auth";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { getWorkspaceContext } from "@/server/services/workspace-context";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const [ctx, session] = await Promise.all([getWorkspaceContext(workspaceSlug), auth()]);

  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/w/${workspaceSlug}/dashboard`)}`);
  }
  if (!ctx) {
    notFound();
  }

  const workspaces = ctx.memberships.map((m) => ({
    slug: m.workspace.slug,
    name: m.workspace.name,
    role: m.role,
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar workspaceSlug={workspaceSlug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          current={{
            slug: ctx.workspace.slug,
            name: ctx.workspace.name,
            role: ctx.role,
          }}
          workspaces={workspaces}
          role={ctx.role}
          user={session.user}
        />
        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
