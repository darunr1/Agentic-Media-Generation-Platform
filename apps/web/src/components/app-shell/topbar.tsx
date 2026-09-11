import type { Session } from "next-auth";

import { Badge } from "@contentforge/ui";

import { UserMenu } from "./user-menu";
import type { WorkspaceSwitcherItem } from "./workspace-switcher";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function Topbar({
  current,
  workspaces,
  role,
  user,
}: {
  current: WorkspaceSwitcherItem;
  workspaces: WorkspaceSwitcherItem[];
  role: string;
  user: NonNullable<Session["user"]>;
}) {
  return (
    <header className="border-border/60 bg-background/80 flex h-16 items-center justify-between border-b px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <WorkspaceSwitcher current={current} workspaces={workspaces} />
        <Badge variant="outline" className="hidden sm:inline-flex">
          {role}
        </Badge>
      </div>
      <UserMenu name={user.name} email={user.email} image={user.image} />
    </header>
  );
}
