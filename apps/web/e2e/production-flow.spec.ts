import { expect, test, type Locator } from "@playwright/test";

test("new campaign becomes an approved, published video with stored analytics", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Run the complete media pipeline once; public tests cover mobile.",
  );
  // Compile the signed-media route before measuring browser playback readiness.
  // The unsigned probe also verifies that arbitrary media downloads are denied.
  const unsignedMedia = await request.get("/api/storage", { timeout: 120000 });
  expect(unsignedMedia.status()).toBe(403);
  async function clickMutation(button: Locator, path: string, method = "POST") {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(path) && r.request().method() === method, {
        timeout: 120000,
      }),
      button.click(),
    ]);
    expect(response.ok(), await response.text()).toBe(true);
    if (path.includes("/generations/")) expect(response.status()).toBe(202);
  }
  await page.goto("/sign-in");
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/auth/callback/dev-login"), {
      timeout: 120000,
    }),
    page.getByRole("button", { name: /seeded demo user/i }).click(),
  ]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/w\/riverbend-coffee\/dashboard/);
  await page.goto("/w/riverbend-coffee/campaigns");
  await page.getByText("Create campaign", { exact: true }).first().click();
  const campaignName = `E2E campaign ${Date.now()}`;
  await page.getByLabel("Campaign name", { exact: true }).first().fill(campaignName);
  await page
    .getByLabel("Campaign objective", { exact: true })
    .first()
    .fill("Teach local home brewers how to enjoy fresh coffee.");
  await page.getByLabel("Start date", { exact: true }).first().fill("2026-09-14");
  await page.getByLabel("End date", { exact: true }).first().fill("2026-10-14");
  await clickMutation(
    page.getByRole("button", { name: "Create campaign", exact: true }),
    "/campaigns",
  );
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  const campaign = page
    .locator("div.rounded-xl.border")
    .filter({ has: page.getByText(campaignName, { exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Generate strategy", exact: true }) })
    .last();
  await clickMutation(
    campaign.getByRole("button", { name: "Generate strategy", exact: true }),
    "/generations/strategy",
  );
  await expect(page).toHaveURL(/workflows\//, { timeout: 120000 });
  await expect(page.getByText("View campaign results", { exact: true })).toBeVisible({
    timeout: 120000,
  });
  await page.getByText("View campaign results", { exact: true }).click();
  const ideasUrl = await campaign
    .getByRole("link", { name: "Open idea board" })
    .getAttribute("href");
  await clickMutation(
    campaign.getByRole("button", { name: "Generate ideas", exact: true }),
    "/generations/ideas",
  );
  await expect(page).toHaveURL(/workflows\//, { timeout: 120000 });
  await expect(page.getByText("View campaign results", { exact: true })).toBeVisible({
    timeout: 120000,
  });
  await page.goto(ideasUrl!);
  // The latest eligible idea belongs to the newly created campaign.
  const accept = page
    .getByRole("button", { name: "Accept idea", exact: true })
    .and(page.locator(":enabled"));
  await clickMutation(accept.last(), "/ideas/", "PATCH");
  await expect(page).toHaveURL(/studio\?contentId=/, { timeout: 120000 });
  const contentUrl = page.url();
  await clickMutation(
    page.getByRole("button", { name: "Generate script and video" }),
    "/generations/script",
  );
  await expect(page).toHaveURL(/workflows\//, { timeout: 120000 });
  await expect(page.getByText("Open content in the studio", { exact: true })).toBeVisible({
    timeout: 120000,
  });
  await page.reload();
  await expect(page.getByText("Rendering", { exact: true })).toBeVisible();
  await page.getByText("Open content in the studio", { exact: true }).click();
  const video = page.getByLabel("Rendered content preview");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
    .toBeGreaterThanOrEqual(1);
  await video.evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play();
  });
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0);
  await video.evaluate((el: HTMLVideoElement) => el.pause());
  const mediaUrl = await video.getAttribute("src");
  expect(mediaUrl).toBeTruthy();
  const media = await request.get(mediaUrl!, { headers: { Range: "bytes=0-31" } });
  expect(media.status()).toBe(206);
  await page.getByRole("link", { name: "Open approval queue" }).click();
  await page.getByLabel("I reviewed the content and acknowledge compliance.").first().check();
  await clickMutation(
    page.getByRole("button", { name: "Approve", exact: true }).first(),
    "/approvals",
  );
  await page.goto(contentUrl);
  await clickMutation(
    page.getByRole("button", { name: "Schedule approved content" }),
    "/publishing",
  );
  await expect
    .poll(
      async () => {
        await page.reload();
        return page.getByText("PUBLISHED", { exact: true }).count();
      },
      { timeout: 120000 },
    )
    .toBeGreaterThan(0);
  const contentId = new URL(contentUrl).searchParams.get("contentId")!;
  await page.goto(`/w/riverbend-coffee/analytics?platform=MOCK&contentId=${contentId}`);
  await expect(page.getByRole("heading", { name: "Evidence-based recommendations" })).toBeVisible();
  const csv = await page.getByRole("link", { name: "Export CSV" }).getAttribute("href");
  await expect
    .poll(
      async () => {
        const response = await page.request.get(csv!);
        expect(response.ok()).toBe(true);
        const text = await response.text();
        expect(text).toContain("completionRate");
        return text.trim().split(/\r?\n/).length;
      },
      { timeout: 30000 },
    )
    .toBe(2); // Header plus this newly published content, not seeded analytics.
});
