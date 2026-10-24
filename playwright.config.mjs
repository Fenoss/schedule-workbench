import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  timeout: 120000,
  workers: 2,
  reporter: [["list"]],
  use: {
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
});
