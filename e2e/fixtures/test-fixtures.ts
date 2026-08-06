/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect, Page } from '@playwright/test';

/**
 * Credenciais dos usuários de E2E — sempre do ambiente, sem fallback.
 *
 * Um fallback embutido aqui seria senha pública (repo aberto) de conta viva em
 * PRODUÇÃO, e ainda por cima silencioso: o teste passaria localmente e ninguém
 * perceberia que a senha vazou. Falhar cedo é o comportamento correto.
 */
function requireEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `${nome} não está definida. Defina as credenciais de E2E no ambiente ` +
        `(nunca no código — este repositório é público).`,
    );
  }
  return valor;
}

export const testUsers = {
  motorista: {
    get email() {
      return requireEnv('E2E_MOTORISTA_EMAIL');
    },
    get password() {
      return requireEnv('E2E_MOTORISTA_PASSWORD');
    },
  },
  gestor: {
    get email() {
      return requireEnv('E2E_GESTOR_EMAIL');
    },
    get password() {
      return requireEnv('E2E_GESTOR_PASSWORD');
    },
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
    'input[placeholder="E-mail"], input[placeholder="seu@email.com"], input:not([type="password"])',
  );
  const passwordInput = page.locator(
    'input[placeholder="Senha"], input[type="password"]',
  );
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
  await page.waitForURL(
    userType === 'motorista' ? '**/motorista**' : '**/gestor**',
    {
      timeout: 60000,
    },
  );
}

/**
 * Helper to logout
 */
async function logout(page: Page) {
  // Try to open drawer menu and click logout
  const menuButton = page
    .locator('[data-testid="menu-button"], [aria-label*="menu"]')
    .first();
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
