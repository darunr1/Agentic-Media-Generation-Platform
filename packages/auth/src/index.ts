import NextAuth from "next-auth";

import { buildAuthConfig } from "./config";

export const { handlers, auth, signIn, signOut } = NextAuth(buildAuthConfig());

export { hasPermission, permissionsForRole } from "./permissions";
export type { Permission } from "./permissions";
export {
  assertWorkspaceMembership,
  assertWorkspacePermission,
  getWorkspaceMembership,
  listUserWorkspaceMemberships,
} from "./workspace";
