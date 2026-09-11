import type { WorkspaceRole } from "@contentforge/database";

/**
 * Discrete, named permissions rather than a linear role hierarchy — a
 * REVIEWER can approve content but not edit brand settings, which a strict
 * "higher role can do everything a lower role can" ladder can't express.
 * Every route handler and server action calls `hasPermission`/
 * `assertPermission` instead of comparing role strings directly, so a
 * permission change is a one-place edit (see ARCHITECTURE.md ADR #7).
 */
export type Permission =
  | "workspace:manage" // rename, delete, transfer ownership
  | "team:manage" // invite/remove members, change roles
  | "billing:manage" // checkout, portal, plan changes
  | "brand:write"
  | "campaign:write"
  | "content:write" // create/edit content items, scripts, scenes
  | "content:generate" // trigger AI generation / render jobs
  | "content:approve" // approval decisions
  | "content:comment"
  | "social:manage" // connect/disconnect social accounts
  | "publish:execute" // schedule/publish approved content
  | "settings:write";

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: [
    "workspace:manage",
    "team:manage",
    "billing:manage",
    "brand:write",
    "campaign:write",
    "content:write",
    "content:generate",
    "content:approve",
    "content:comment",
    "social:manage",
    "publish:execute",
    "settings:write",
  ],
  ADMIN: [
    "team:manage",
    "brand:write",
    "campaign:write",
    "content:write",
    "content:generate",
    "content:approve",
    "content:comment",
    "social:manage",
    "publish:execute",
    "settings:write",
  ],
  EDITOR: ["brand:write", "campaign:write", "content:write", "content:generate", "content:comment"],
  REVIEWER: ["content:approve", "content:comment"],
  VIEWER: [],
};

export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsForRole(role: WorkspaceRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
