/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect, Page } from '@playwright/test';

/**
 * Test user credentials for E2E tests
 * Use environment variables in CI, fallback to test accounts
 */
export const testUsers = {
  motorista: {
    email: process.env.E2E_MOTORISTA_EMAIL || 'motorista.test@rotamestre.tec.br',
    password: process.env.E2E_MOTORISTA_PASSWORD || 'Test@123456',
  },
  gestor: {
    email: process.env.E2E_GESTOR_EMAIL || 'gestor.test@rotamestre.tec.br',
    password: process.env.E2E_GESTOR_PASSWORD || 'Test@123456',
  },
};

/**
 * Helper to append e2e=true param to URL for skipping font wait
 */
export function e2eUrl(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}e2e=true`;
}

/**
 * Wait for React Native Web app to fully load
 */
async function waitForAppReady(page: Page) {
  // Wait for DOM to be ready
  await page.waitForLoadState('domcontentloaded');
  // Give React Native Web time to hydrate
  await page.waitForTimeout(2000);
}

/**
 * Helper to login as a specific user type
 * Uses locators compatible with React Native Web
 */
async function login(page: Page, userType: 'motorista' | 'gestor') {
  const user = testUsers[userType];

  // Include e2e=true to skip font loading wait in React Native Web
  await page.goto('/auth/login?e2e=true', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);

  // React Native Web renders TextInput as standard <input> elements
  const emailInput = page.locator(
    'input[placeholder="E-mail"], input[placeholder="seu@email.com"], input:not([type="password"])'
  );
  const passwordInput = page.locator('input[placeholder="Senha"], input[type="password"]');
  const loginButton = page.getByText('Entrar', { exact: true });

  // Wait for form to be visible
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });

  // Fill login form
  await emailInput.click();
  await emailInput.fill(user.email);
  await passwordInput.click();
  await passwordInput.fill(user.password);

  // Click login button
  await loginButton.click();

  // Wait for navigation to complete
  await page.waitForURL(userType === 'motorista' ? '**/motorista**' : '**/gestor**', {
    timeout: 30000,
  });
}

/**
 * Helper to logout
 */
async function logout(page: Page) {
  // Try to open drawer menu and click logout
  const menuButton = page.locator('[data-testid="menu-button"], [aria-label*="menu"]').first();
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await page.waitForTimeout(500);
    await page.getByText(/sair/i).click();
    await page.waitForURL('**/auth/login**');
  }
}

/**
 * Wait for app to be fully loaded
 */
async function waitForAppLoad(page: Page) {
  await waitForAppReady(page);
}

/**
 * Extended test fixtures with helper functions
 */
export const test = base.extend<{
  loginAsMotorista: () => Promise<void>;
  loginAsGestor: () => Promise<void>;
  logout: () => Promise<void>;
  waitForAppLoad: () => Promise<void>;
}>({
  loginAsMotorista: async ({ page }, use) => {
    await use(async () => {
      await login(page, 'motorista');
    });
  },

  loginAsGestor: async ({ page }, use) => {
    await use(async () => {
      await login(page, 'gestor');
    });
  },

  logout: async ({ page }, use) => {
    await use(async () => {
      await logout(page);
    });
  },

  waitForAppLoad: async ({ page }, use) => {
    await use(async () => {
      await waitForAppLoad(page);
    });
  },
});

export { expect };
