/**
 * Global type augmentations for E2E testing (Playwright)
 */

interface Window {
  /** Playwright-injected flag for E2E environment detection */
  __PLAYWRIGHT_E2E__?: boolean;
}

interface Navigator {
  /** Set to true by Playwright/Selenium during automated testing */
  webdriver?: boolean;
}
