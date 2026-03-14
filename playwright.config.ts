import { defineConfig } from '@playwright/test';

// Playwright requires a default export — see https://playwright.dev/docs/test-configuration
// eslint-disable-next-line
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
