import { test, expect } from "@playwright/test";
import path from "node:path";
test("demo, finding, review, import and report downloads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Explore the demo" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "../../reports/screenshots/01-landing.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer view of where to start" }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../reports/screenshots/02-portfolio.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: "../../reports/screenshots/07-portfolio-pitch.png",
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page
    .getByRole("button", { name: "Open Building 03", exact: true })
    .click();
  await expect(page.getByText("Trace the comparison")).toBeVisible();
  await page.screenshot({
    path: "../../reports/screenshots/03-building.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../reports/screenshots/08-building-pitch.png",
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page
    .getByRole("button", { name: "Create review task", exact: true })
    .click();
  await page
    .getByLabel("User assessment / note")
    .fill("Check invoices and consult technical reviewer.");
  await page
    .getByRole("button", { name: "Save review task", exact: true })
    .click();
  await expect(
    page.getByText("Review task saved with status history."),
  ).toBeVisible();
  await page.screenshot({
    path: "../../reports/screenshots/04-task.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Update task" }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("reviewing");
  await page
    .getByRole("button", { name: "Save review task", exact: true })
    .click();
  await expect(page.getByText("Status history (2)")).toBeVisible();
  await page.getByRole("button", { name: "Import data", exact: true }).click();
  await page
    .getByLabel("Consumption file")
    .setInputFiles(path.resolve("../../data/templates/consumption.csv"));
  await page.getByRole("button", { name: "Preview & validate" }).click();
  await expect(
    page.getByText(
      "1 source rows · 0 errors · 0 existing building/month records",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: "../../reports/screenshots/05-import.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Confirm import & analyze" }).click();
  await expect(
    page.getByText(/Import complete: 1 records written/),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Evidence PDF" }).click();
  await (await download).saveAs("../../reports/journey-evidence.pdf");
  const csv = page.waitForEvent("download");
  await page.getByRole("link", { name: "Findings CSV" }).click();
  await (await csv).saveAs("../../reports/journey-findings.csv");
  await page
    .getByRole("button", { name: "Interventions", exact: true })
    .click();
  await expect(
    page.getByText("Not enough post-intervention data", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../reports/screenshots/06-interventions.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

for (const width of [1440, 1024, 390])
  test(`responsive ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "Explore the demo" }).click();
    await expect(
      page.getByRole("heading", { name: "Buildings to review" }),
    ).toBeVisible();
    await page.screenshot({
      path: `../../reports/screenshots/portfolio-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= window.innerWidth &&
          document.body.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  });
