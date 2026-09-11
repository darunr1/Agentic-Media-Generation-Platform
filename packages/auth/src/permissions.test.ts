import { describe, expect, it } from "vitest";

import { hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("gives OWNER every permission", () => {
    expect(hasPermission("OWNER", "workspace:manage")).toBe(true);
    expect(hasPermission("OWNER", "billing:manage")).toBe(true);
    expect(hasPermission("OWNER", "publish:execute")).toBe(true);
  });

  it("does not let ADMIN manage the workspace or billing", () => {
    expect(hasPermission("ADMIN", "workspace:manage")).toBe(false);
    expect(hasPermission("ADMIN", "billing:manage")).toBe(false);
    expect(hasPermission("ADMIN", "publish:execute")).toBe(true);
  });

  it("lets EDITOR write content but not approve it", () => {
    expect(hasPermission("EDITOR", "content:write")).toBe(true);
    expect(hasPermission("EDITOR", "content:approve")).toBe(false);
  });

  it("lets REVIEWER approve content but not write it", () => {
    expect(hasPermission("REVIEWER", "content:approve")).toBe(true);
    expect(hasPermission("REVIEWER", "content:write")).toBe(false);
  });

  it("gives VIEWER no write permissions", () => {
    expect(hasPermission("VIEWER", "content:write")).toBe(false);
    expect(hasPermission("VIEWER", "content:approve")).toBe(false);
    expect(hasPermission("VIEWER", "content:comment")).toBe(false);
  });
});
