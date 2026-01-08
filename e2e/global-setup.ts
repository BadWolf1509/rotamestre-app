import * as fs from 'fs';
import * as path from 'path';

import { chromium } from '@playwright/test';

import type { FullConfig } from '@playwright/test';

const DEFAULT_BASE_URL = 'http://localhost:8082';
const APP_READY_TIMEOUT_MS = 180000;
const LOGIN_WAIT_MS = 60000; // Increased for CI
const RETRY_DELAY_MS = 5000;
const HYDRATION_WAIT_MS = 5000; // Wait for React hydration
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
      // Use 'load' instead of 'domcontentloaded' to ensure all resources are loaded
      // Pass e2e=true to skip font loading wait
      await page.goto('/auth/login?e2e=true', {
        waitUntil: 'load',
        timeout: LOGIN_WAIT_MS,
      });

      // Wait for fonts to be ready (common issue in CI)
      console.log('[global-setup] Waiting for fonts to load...');
      await page.evaluate(() => document.fonts.ready);
      console.log('[global-setup] Fonts ready');

      // Wait for React to hydrate - CI environments have limited CPU
      // This gives React time to mount components and attach event handlers
      const hydrationWait = isCI ? HYDRATION_WAIT_MS : 2000;
      console.log(`[global-setup] Waiting ${hydrationWait}ms for React hydration...`);
      await page.waitForTimeout(hydrationWait);

      // Check if React has rendered any content
      const bodyContent = await page.locator('body').innerText();
      console.log(`[global-setup] Page body length: ${bodyContent.length} chars`);

      // Verify React root has content (not just empty shell)
      const reactRoot = page.locator('#root, #__next, [data-reactroot]');
      const rootContent = await reactRoot.first().innerHTML().catch(() => '');
      const hasReactContent = rootContent.length > 100; // Minimal React content check
      console.log(`[global-setup] React root content length: ${rootContent.length} chars, hasContent: ${hasReactContent}`);

      if (!hasReactContent) {
        console.log('[global-setup] React has not rendered yet, retrying...');
        throw new Error('React content not rendered');
      }

      // Look for the password input using multiple selectors (same as login.page.ts)
      const passwordInput = page.locator('[data-testid="auth-login-password"]').or(
        page.locator('input[placeholder="Senha"], input[type="password"]')
      );
      const submitButton = page.locator('[data-testid="auth-login-submit"]').or(
        page.locator('button:has-text("Entrar"), [role="button"]:has-text("Entrar")')
      );
      // Also check for any input as a basic hydration check
      const anyInput = page.locator('input').first();

      // Check if any input exists (basic hydration check)
      const anyInputExists = await anyInput.count();
      console.log(`[global-setup] Any input found: ${anyInputExists}`);

      // Check if elements exist in DOM (even if not visible)
      const passwordExists = await passwordInput.count();
      const submitExists = await submitButton.count();
      console.log(`[global-setup] Elements found - password: ${passwordExists}, submit: ${submitExists}`);

      if (anyInputExists === 0) {
        // No inputs at all - page hasn't hydrated or is showing loading state
        console.log('[global-setup] No inputs found - page may be loading');

        // Check for common loading states
        const loadingExists = await page.locator('[data-testid="loading"], .loading, [role="progressbar"]').count();
        console.log(`[global-setup] Loading indicators: ${loadingExists}`);

        // Take screenshot for debugging
        const screenshotPath = path.join(DEBUG_SCREENSHOTS_DIR, `attempt-${attempts}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[global-setup] Screenshot saved: ${screenshotPath}`);

        throw new Error('No input fields found in DOM - page may be loading');
      }

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
      await passwordInput.first().waitFor({
        state: 'visible',
        timeout: LOGIN_WAIT_MS,
      });
      await submitButton.first().waitFor({
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
