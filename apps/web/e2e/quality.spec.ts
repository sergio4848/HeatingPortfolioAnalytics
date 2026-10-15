import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

test("search, sorting, pagination and reloadable building navigation", async ({
  page,
}) => {
  await page.goto("/#/portfolio");
  await expect(
    page.getByRole("heading", { name: "Portfolio overview" }),
  ).toBeVisible();
  await expect(page.locator(".building-table-panel tbody tr")).toHaveCount(10);
  await page.getByRole("button", { name: "Next building page" }).click();
  await expect(page.locator(".building-table-panel tbody tr")).toHaveCount(2);
  await page
    .getByRole("searchbox", { name: "Search buildings" })
    .fill("Building 03");
  await expect(page.locator(".building-table-panel tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Findings CSV" }),
  ).toHaveAttribute("href", /q=Building\+03/);
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Building", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Building", exact: true }),
  ).toHaveAttribute("aria-sort", "ascending");
  await expect(
    page.locator(".building-table-panel tbody tr").first(),
  ).toContainText("Building 01");
  await page
    .getByRole("button", { name: "Open Building 03", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/building\//);
  await page.reload();
  await expect(page.getByText("Trace the comparison")).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Portfolio overview" }),
  ).toBeVisible();
});

test("reports use the applied period and reset requires explicit confirmation", async ({
  page,
}) => {
  await page.goto("/#/portfolio");
  const report = page.getByRole("link", { name: "Findings CSV" });
  await expect(report).toHaveAttribute("href", /start=2026-01/);
  await page.getByLabel("From", { exact: true }).fill("2026-02-01");
  await expect(report).toHaveAttribute("href", /start=2026-01/);
  await page.getByRole("button", { name: "Apply period" }).click();
  await expect(report).toHaveAttribute("href", /start=2026-02/);
  await page.getByRole("button", { name: "Reset my demo" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep my work" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reset my demo" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Reset my demo" }).click();
  await page
    .getByRole("button", { name: "Reset workspace", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.locator(".building-table-panel tbody tr")).toHaveCount(10);
});

test("service errors stay visible without creating a replacement demo session", async ({
  page,
}) => {
  let initializations = 0;
  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "POST") initializations++;
    if (route.request().method() === "GET")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"detail":"Temporary service interruption"}',
      });
    else await route.continue();
  });
  await page.goto("/#/portfolio");
  await expect(page.getByRole("alert")).toContainText(
    "Temporary service interruption",
  );
  expect(initializations).toBe(0);
});

for (const width of [1440, 390]) {
  test(`WCAG automated checks across product views at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const evidence: unknown[] = [];
    await mkdir("../../reports/accessibility", { recursive: true });
    for (const route of [
      "/",
      "/#/portfolio",
      "/#/building/SYN-003",
      "/#/import",
      "/#/tasks",
      "/#/monitoring",
      "/#/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator(".loading")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      evidence.push({
        route,
        violations: result.violations,
        passes: result.passes.length,
        incomplete: result.incomplete.map((item) => ({
          id: item.id,
          description: item.description,
          nodes: item.nodes.length,
        })),
      });
      await writeFile(
        `../../reports/accessibility/axe-${width}.json`,
        JSON.stringify(evidence, null, 2),
      );
      expect(result.violations, `Accessibility violations on ${route}`).toEqual(
        [],
      );
    }
  });
}
