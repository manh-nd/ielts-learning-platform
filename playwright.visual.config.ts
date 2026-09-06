import { defineConfig, devices } from "@playwright/test";

const STORYBOOK_PORT = process.env.STORYBOOK_PORT || "6006";
const BASE_URL = `http://127.0.0.1:${STORYBOOK_PORT}`;

export default defineConfig({
  testDir: "./e2e/visual",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 4,
  reporter: [["line"]],
  snapshotPathTemplate:
    "{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    headless: true,
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: "disabled",
    },
  },

  projects: [
    {
      name: "desktop-light",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        colorScheme: "light",
      },
    },
    {
      name: "desktop-dark",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        colorScheme: "dark",
      },
    },
    // Mobile projects emulate canonical smartphone density (375x667 at @2x Retina, e.g. iPhone SE).
    // Explicit DPR 2 matches real-world mobile displays and prevents 1x FreeType grid-snapping
    // distortion on Vietnamese diacritics under Chromium/Linux.
    {
      name: "mobile-light",
      use: {
        viewport: { width: 375, height: 667 },
        isMobile: true,
        deviceScaleFactor: 2,
        colorScheme: "light",
      },
    },
    {
      name: "mobile-dark",
      use: {
        viewport: { width: 375, height: 667 },
        isMobile: true,
        deviceScaleFactor: 2,
        colorScheme: "dark",
      },
    },
  ],

  webServer: {
    command: `python3 -m http.server ${STORYBOOK_PORT} --directory storybook-static --bind 127.0.0.1`,
    url: `${BASE_URL}/iframe.html`,
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 15 * 1000,
  },
});
