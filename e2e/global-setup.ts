import { chromium } from '@playwright/test';

import type { FullConfig } from '@playwright/test';

const DEFAULT_BASE_URL = 'http://localhost:8082';
const APP_READY_TIMEOUT_MS = 180000;
const LOGIN_WAIT_MS = 30000;
const RETRY_DELAY_MS = 5000;

async function globalSetup(config: FullConfig) {
  const configBaseURL = config.projects[0]?.use?.baseURL;
  const baseURL =
    process.env.E2E_BASE_URL ||
    (typeof configBaseURL === 'string' ? configBaseURL : DEFAULT_BASE_URL);

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  const deadline = Date.now() + APP_READY_TIMEOUT_MS;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
      await page.locator('input[type="password"]').waitFor({
        state: 'visible',
        timeout: LOGIN_WAIT_MS,
      });
      await page.getByText('Entrar', { exact: true }).waitFor({
        state: 'visible',
        timeout: LOGIN_WAIT_MS,
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(RETRY_DELAY_MS);
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }

  await context.close();
  await browser.close();

  if (lastError) {
    throw lastError;
  }
}

export default globalSetup;
