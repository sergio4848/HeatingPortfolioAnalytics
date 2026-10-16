import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

test("mapping changes require revalidation; AI stays optional", async ({
  page,
}) => {
  await page.goto("/#/import");
  await page
    .getByLabel("Consumption file")
    .setInputFiles(path.resolve("../../data/templates/consumption.csv"));
  await page.getByRole("button", { name: "Preview & validate" }).click();
  await expect(
    page.getByRole("heading", { name: "Suggested column mapping" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Suggest column mapping", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Existing records policy").selectOption("skip");
  const confirm = page.getByRole("button", {
    name: "Confirm import & analyze",
  });
  await expect(confirm).toBeEnabled();
  await page.locator(".mapping select").first().selectOption("__ignore__");
  await expect(confirm).toBeDisabled();
  await page.getByRole("button", { name: "Revalidate mapping" }).click();
  await expect(
    page.getByText("Mapping changed. Revalidate before confirming import."),
  ).toHaveCount(0);
  await expect(confirm).toBeDisabled();
});

test("local sources work without API; failures and source deletion remain visible", async ({
  page,
}) => {
  await page.goto("/#/building/SYN-003");
  await expect(
    page.getByRole("button", { name: "Explain this finding", exact: true }),
  ).toBeDisabled();
  await mkdir("../../reports/screenshots", { recursive: true });
  await page
    .locator(".ai-workbench")
    .screenshot({ path: "../../reports/screenshots/09-ai-evidence.png" });
  await page.getByText("Maintenance sources (0)", { exact: true }).click();
  await page.getByLabel("Recorded date").fill("2025-12-01");
  await page.getByLabel("Source title").fill("Synthetic valve inspection");
  await page.getByLabel("Source / provenance").fill("Synthetic QA record");
  await page
    .getByLabel("Maintenance note")
    .fill(
      "A valve inspection was recorded. A causal relationship has not been established.",
    );
  await page.getByRole("button", { name: "Save source locally" }).click();
  await expect(
    page.getByText("Maintenance sources (1)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic valve inspection", { exact: true }),
  ).toBeVisible();
  await mkdir("../../reports/ui-review", { recursive: true });
  await page.screenshot({
    path: "../../reports/ui-review/1440-maintenance-source.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Remove source" }).click();
  await page.getByRole("button", { name: "Confirm source removal" }).click();
  await expect(
    page.getByText("Maintenance sources (0)", { exact: true }),
  ).toBeVisible();
});

test("desktop gallery keyboard, arrows, drag and route cleanup", async ({
  page,
}) => {
  await page.goto("/");
  const gallery = page.getByRole("region", {
    name: "Product workflow gallery",
  });
  await expect(page.locator("html")).toHaveClass(/lenis/);
  await page.getByRole("button", { name: "Next product view" }).click();
  await expect
    .poll(() => gallery.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(200);
  await gallery.focus();
  await page.keyboard.press("End");
  await expect
    .poll(() => gallery.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(1500);
  await page.keyboard.press("Home");
  await expect
    .poll(() => gallery.evaluate((el) => el.scrollLeft))
    .toBeLessThan(5);
  const box = await gallery.boundingBox();
  if (!box) throw new Error("Gallery missing");
  await page.mouse.move(box.x + box.width * 0.75, box.y + 130);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + 130, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() => gallery.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(100);
  await page
    .getByRole("button", { name: "Explore the demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Portfolio overview" }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
});

test("reduced motion, mobile menu, long names, empty and error states", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
  const slides = page.locator(".showcase-slide");
  const positions = await slides.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().top),
  );
  expect(
    positions.every((top, i) => !i || top > positions[i - 1]),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Menu", { exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Mobile product navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("navigation", { name: "Mobile product navigation" }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Explore the demo", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search buildings" })
    .fill("No matching building");
  await expect(page.locator(".building-table-panel tbody tr")).toHaveCount(0);
  await page.goto("/#/building/SYN-003");
  await page.route("**/api/ai/buildings/*/evidence?*", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Evidence temporarily unavailable" },
    }),
  );
  await page.reload();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Evidence temporarily unavailable" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../reports/ui-review/390-evidence-error.png",
    fullPage: true,
  });
});

test("local performance observation and dashboard bundle separation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(() => {
    const state = { lcp: 0, cls: 0 };
    (window as unknown as { __perf: typeof state }).__perf = state;
    new PerformanceObserver((list) => {
      for (const item of list.getEntries()) state.lcp = item.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const item of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[])
        if (!item.hadRecentInput) state.cls += item.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Explore the demo", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveClass(/lenis/);
  const metrics = await page.evaluate(() => ({
    ...(window as unknown as { __perf: { lcp: number; cls: number } }).__perf,
    navigation: performance.getEntriesByType("navigation")[0].toJSON(),
  }));
  const dash = await context.newPage();
  const assets: string[] = [];
  dash.on("request", (r) => {
    if (r.resourceType() === "script") assets.push(r.url());
  });
  await dash.goto("/#/portfolio");
  await expect(
    dash.getByRole("heading", { name: "Portfolio overview" }),
  ).toBeVisible();
  expect(assets.some((url) => /landing-motion/.test(url))).toBeFalsy();
  await writeFile(
    "../../reports/ui-review/performance-local.json",
    JSON.stringify(
      {
        conditions:
          "Local Chromium, 1440x1000, no CPU/network throttling, fresh browser context; laboratory observation, not field Core Web Vitals or Lighthouse.",
        metrics,
        dashboardScriptRequests: assets,
      },
      null,
      2,
    ),
  );
  await context.close();
});

test("findings exclude buildings within reference and long names fit", async ({
  page,
}) => {
  await page.goto("/#/findings");
  await expect(
    page.getByRole("heading", { name: "Findings", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".panel .status").filter({ hasText: "within reference" }),
  ).toHaveCount(0);
  await page.route("**/api/portfolio?*", async (route) => {
    const response = await route.fetch();
    const value = await response.json();
    value.items[0].name =
      "Synthetic building with a deliberately long portfolio display name for a regional apartment-management review team";
    await route.fulfill({ response, json: value });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/buildings");
  await page.reload();
  await expect(page.locator(".building-table-panel")).toContainText(
    "deliberately long portfolio",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "../../reports/ui-review/390-long-building-name.png",
    fullPage: true,
  });
});

test("MOCK protocol only: source dialog and edited draft require explicit approval", async ({
  page,
}) => {
  // Explicit test double. No provider request, screenshot or claim of live execution.
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({
      json: {
        server_enabled: true,
        provider_configured: true,
        organization_enabled: true,
        real_data_authorized: false,
        can_configure: true,
        data_type: "synthetic",
        model: "TEST DOUBLE - no API request",
      },
    }),
  );
  let version = "";
  let approvals = 0;
  await page.route("**/api/ai/buildings/*/evidence?*", async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    version = pack.analysis_version;
    await route.fulfill({ response, json: pack });
  });
  await page.route("**/api/ai/buildings/*/task-draft", (route) =>
    route.fulfill({
      json: {
        id: "test-draft",
        feature: "task_draft",
        mode: "live_claude",
        model: "TEST DOUBLE - no API request",
        created_at: new Date().toISOString(),
        analysis_version: version,
        current: true,
        content: {
          title: "Review the source records",
          evidence_summary: "Review observed use against the reference.",
          checks: [
            { action: "Check meter records", question: "Do periods agree?" },
          ],
          missing_information: ["Occupancy changes"],
          suggested_role: "Analyst role",
          closure_records: ["Reviewed invoice records"],
          metric_ids: ["deviation"],
          source_ids: ["analysis"],
        },
      },
    }),
  );
  await page.route("**/api/ai/drafts/test-draft/approve", async (route) => {
    approvals++;
    const body = route.request().postDataJSON();
    expect(body.confirmed).toBeTruthy();
    expect(body.title).toBe("Human-edited review title");
    expect(body.analysis_version).toBe(version);
    await route.fulfill({ json: { id: "test-task" } });
  });
  await page.goto("/#/building/SYN-003");
  await expect(
    page.getByRole("button", { name: "Draft investigation task", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /I approve sending this building/ })
    .check();
  await page
    .getByRole("button", { name: "Draft investigation task", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review the investigation task draft" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve and save task" }),
  ).toBeDisabled();
  expect(approvals).toBe(0);
  await page.locator(".ai-result .ai-source-links button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("heading")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Draft task title").fill("Human-edited review title");
  await page
    .getByRole("checkbox", { name: /I have reviewed and edited this draft/ })
    .check();
  await page.getByRole("button", { name: "Approve and save task" }).click();
  await expect(
    page.getByRole("heading", { name: "Make the next step explicit" }),
  ).toBeVisible();
  expect(approvals).toBe(1);
});
