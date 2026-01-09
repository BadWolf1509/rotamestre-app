import { defineConfig, devices } from '@playwright/test';

// Load environment variables from .env
require('dotenv').config();

/**
 * Playwright E2E Test Configuration for React Native Web
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test file pattern
  testMatch: '**/*.e2e.ts',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on failure (2 retries on CI, 1 locally for flaky tests)
  retries: process.env.CI ? 2 : 1,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list'],
  ],

  // Warm up the web bundle before tests start
  globalSetup: './e2e/global-setup.ts',

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8082',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Browser locale
    locale: 'pt-BR',

    // Timezone
    timezoneId: 'America/Sao_Paulo',

    // Action timeout (click, fill, etc) - CI is slower
    actionTimeout: process.env.CI ? 15000 : 10000,

    // Navigation timeout - CI is slower (~2x)
    navigationTimeout: process.env.CI ? 60000 : 30000,
  },

  // Configure projects for major browsers
  projects: [
    // Desktop Chrome
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Mobile Chrome (responsive testing)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        // Mobile tests - CI is slower (~2x)
        actionTimeout: process.env.CI ? 20000 : 15000,
        navigationTimeout: process.env.CI ? 90000 : 45000,
      },
    },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'npm run web -- --port 8082',
    url: 'http://localhost:8082',
    reuseExistingServer: true, // Always reuse existing server
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Global timeout for each test
  // CI is slower (~2x), so use 60s on CI, 30s locally (máx local: ~21s)
  timeout: process.env.CI ? 60000 : 30000,

  // Expect timeout - CI is slower
  expect: {
    timeout: process.env.CI ? 15000 : 10000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },

  // Snapshot path template - remove platform suffix for cross-platform compatibility
  // {testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',
});
