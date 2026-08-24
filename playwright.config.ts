import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT || "3001";
const BASE_URL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: Boolean(process.env.CI),
  /* Retry on CI only */
  retries: 0,
  /* Run with 4 parallel workers for lightning fast execution */
  workers: 4,
  /* Reporter to use - line reporter streams realtime progress */
  reporter: [["line"]],
  /* Shared settings for all the projects below. */
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    headless: true,
  },

  /* Configure projects for major browsers: Chromium only */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Run a clean production server on dedicated test port 3001 with real-time piped logs */
  webServer: {
    command: `bunx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30 * 1000,
    env: {
      ENABLE_E2E_MOCK_AUTH: "true",
    },
  },
});
