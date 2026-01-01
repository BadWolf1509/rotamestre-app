import * as fs from 'fs';
import * as path from 'path';

import { chromium } from '@playwright/test';

import type { FullConfig } from '@playwright/test';

const DEFAULT_BASE_URL = 'http://localhost:8082';
const APP_READY_TIMEOUT_MS = 180000;
const LOGIN_WAIT_MS = 60000; // Increased for CI
const RETRY_DELAY_MS = 5000;
const DEBUG_SCREENSHOTS_DIR = 'e2e-report/debug';

async function globalSetup(config: FullConfig) {
  const configBaseURL = config.projects[0]?.use?.baseURL;
  const baseURL =
    process.env.E2E_BASE_URL ||
    (typeof configBaseURL === 'string' ? configBaseURL : DEFAULT_BASE_URL);

  const isCI = process.env.CI === 'true';

  console.log(`[global-setup] Starting app warmup (baseURL: ${baseURL}, CI: ${isCI})`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  // Ensure debug screenshots directory exists
  if (!fs.existsSync(DEBUG_SCREENSHOTS_DIR)) {
    fs.mkdirSync(DEBUG_SCREENSHOTS_DIR, { recursive: true });
  }

  const deadline = Date.now() + APP_READY_TIMEOUT_MS;
  let lastError: unknown;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts++;
    console.log(`[global-setup] Attempt ${attempts} - navigating to /auth/login`);

    try {
      // Navigate and wait for network to be mostly idle
      await page.goto('/auth/login', {
        waitUntil: 'domcontentloaded',
        timeout: LOGIN_WAIT_MS,
      });

      // Wait for fonts to be ready (common issue in CI)
      console.log('[global-setup] Waiting for fonts to load...');
      await page.evaluate(() => document.fonts.ready);
      console.log('[global-setup] Fonts ready');

      // Wait a bit for React to hydrate
      await page.waitForTimeout(2000);

      // Check if there's any content on the page
      const bodyContent = await page.locator('body').innerText();
      console.log(`[global-setup] Page body length: ${bodyContent.length} chars`);

      // Look for the password input
      const passwordInput = page.locator('[data-testid="auth-login-password"]');
      const submitButton = page.locator('[data-testid="auth-login-submit"]');

      // Check if elements exist in DOM (even if not visible)
      const passwordExists = await passwordInput.count();
      const submitExists = await submitButton.count();
      console.log(`[global-setup] Elements found - password: ${passwordExists}, submit: ${submitExists}`);

      if (passwordExists === 0) {
        // Take screenshot for debugging
        const screenshotPath = path.join(DEBUG_SCREENSHOTS_DIR, `attempt-${attempts}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[global-setup] Screenshot saved: ${screenshotPath}`);

        // Log page HTML for debugging
        const html = await page.content();
        console.log(`[global-setup] Page HTML (first 500 chars): ${html.substring(0, 500)}`);

        throw new Error('Password input not found in DOM');
      }

      // Wait for elements to be visible
      await passwordInput.waitFor({
        state: 'visible',
        timeout: LOGIN_WAIT_MS,
      });
      await submitButton.waitFor({
        state: 'visible',
        timeout: LOGIN_WAIT_MS,
      });

      console.log('[global-setup] App is ready! Elements are visible.');
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      console.log(`[global-setup] Attempt ${attempts} failed: ${(error as Error).message}`);

      // Take debug screenshot on failure
      try {
        const screenshotPath = path.join(DEBUG_SCREENSHOTS_DIR, `failure-${attempts}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        // Ignore screenshot errors
      }

      await page.waitForTimeout(RETRY_DELAY_MS);
    }
  }

  await context.close();
  await browser.close();

  if (lastError) {
    console.error(`[global-setup] All attempts failed after ${attempts} tries`);
    throw lastError;
  }

  console.log(`[global-setup] Warmup completed successfully after ${attempts} attempts`);
}

export default globalSetup;
