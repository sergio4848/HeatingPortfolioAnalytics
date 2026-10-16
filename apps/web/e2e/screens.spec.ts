import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const screens = [
  ["home", "/"],
  ["portfolio", "/#/portfolio"],
  ["building", "/#/building/SYN-003"],
  ["import", "/#/import"],
  ["tasks", "/#/tasks"],
  ["interventions", "/#/monitoring"],
  ["settings", "/#/settings"],
  ["buildings", "/#/buildings"],
  ["findings", "/#/findings"],
  ["reports", "/#/reports"],
  ["assistant", "/#/assistant"],
] as const;

for (const width of [1440, 1024, 768, 390, 360]) {
  test(`all screens fit the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mkdir("../../reports/ui-review", { recursive: true });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Explore the demo", exact: true }),
    ).toBeEnabled();
    const evidence = [];
    for (const [name, route] of screens) {
      if (name !== "home") await page.goto(route);
      await expect(page.locator(".loading")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      for (const chart of await page.locator(".chart").all())
        await expect(chart.locator("svg.recharts-surface")).toBeVisible();
      const size = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      evidence.push({ screen: name, ...size });
      expect(size.document, `${name}: document overflow`).toBeLessThanOrEqual(
        size.viewport,
      );
      expect(size.body, `${name}: body overflow`).toBeLessThanOrEqual(
        size.viewport,
      );
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `../../reports/ui-review/${width}-${name}.png`,
          fullPage: true,
        });
      if (name === "tasks") {
        await page
          .getByRole("button", { name: "New review task", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "No reviews assigned yet" }),
        ).toHaveCount(0);
        if (width === 1440 || width === 390)
          await page.screenshot({
            path: `../../reports/ui-review/${width}-task-form.png`,
            fullPage: true,
          });
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
      }
    }
    await writeFile(
      `../../reports/ui-review/layout-${width}.json`,
      JSON.stringify(evidence, null, 2),
    );
  });
}

for (const width of [1440, 390])
  test(`${width}px reset clears stale import previews and audit distinguishes empty from loaded changes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#/import");
    await page
      .getByLabel("Consumption file")
      .setInputFiles(path.resolve("../../data/templates/consumption.csv"));
    await page.getByRole("button", { name: "Preview & validate" }).click();
    await expect(
      page.getByRole("heading", { name: "Validation result" }),
    ).toBeVisible();
    if (width === 390)
      await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Reset my demo" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.screenshot({
      path: `../../reports/ui-review/${width}-reset-dialog.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Reset workspace", exact: true })
      .click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    if (width === 1440) {
      await expect(page.getByLabel("Consumption file")).toHaveValue("");
      await expect(
        page.getByRole("heading", { name: "Validation result" }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Settings", exact: true }).click();
    }
    await page.getByRole("button", { name: "Load audit trail" }).click();
    await expect(
      page.getByText("No changes recorded in this workspace.", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Organization name").fill("Mobile review portfolio");
    await page
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await expect(
      page.getByText("Settings saved and change recorded."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Refresh audit trail" }).click();
    await expect(
      page.getByText("Workspace settings changed", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Import data", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Validation result" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Preview & validate" }),
    ).toBeDisabled();
  });
