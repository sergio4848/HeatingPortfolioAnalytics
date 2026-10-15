import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:8000",
    viewport: { width: 1440, height: 1100 },
    launchOptions: process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {},
  },
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "../../reports/e2e-results.json" }],
  ],
});
