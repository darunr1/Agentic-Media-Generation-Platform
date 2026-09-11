import { expect, test } from "@playwright/test";
test("public product and pricing journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/pricing");
  await expect(page).toHaveURL(/pricing/);
  await expect(page.getByText(/Starter/i).first()).toBeVisible();
});
test("workspace routes require authentication", async ({ page }) => {
  await page.goto("/w/riverbend-coffee/dashboard");
  await expect(page).toHaveURL(/sign-in/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});
test("privacy and terms are reachable", async ({ page }) => {
  for (const path of ["/privacy", "/terms"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
  }
});
test("seeded user can traverse the complete product workspace", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Authenticated journey is covered once; public pages cover mobile rendering.",
  );
  await page.goto("/sign-in");
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/auth/callback/dev-login")),
    page.getByRole("button", { name: /seeded demo user/i }).click(),
  ]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/w\/riverbend-coffee\/dashboard/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  for (const [path, heading] of [
    ["brand", "Riverbend Coffee Roasters"],
    ["ideas", "Idea board"],
    ["studio", "Taste coffee in three steps"],
    ["approvals", "Approval queue"],
    ["analytics", "Analytics"],
  ] as const) {
    await page.goto(`/w/riverbend-coffee/${path}`);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});
