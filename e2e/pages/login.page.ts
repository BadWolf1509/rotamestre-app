import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for Login screen
 * Uses locators compatible with React Native Web
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly errorMessage: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    // React Native Web renders TextInput as <input> elements
    this.emailInput = page.locator('[data-testid="auth-login-email"]').or(
      page.locator(
        'input[placeholder="E-mail"], input[placeholder="seu@email.com"], input:not([type="password"])'
      )
    );
    this.passwordInput = page.locator('[data-testid="auth-login-password"]').or(
      page.locator('input[placeholder="Senha"], input[type="password"]')
    );
    // React Native Web renders TouchableOpacity as divs, use testID first
    this.loginButton = page.locator('[data-testid="auth-login-submit"]').first();
    this.forgotPasswordLink = page.locator('[data-testid="auth-login-forgot"]').first();
    this.errorMessage = page.locator('[role="alertdialog"], [role="dialog"]');
    this.loadingIndicator = page.locator('[data-testid="loading"], .loading');
  }

  async goto() {
    // Include e2e=true to skip font loading wait in React Native Web
    await this.page.goto('/auth/login?e2e=true', { waitUntil: 'commit' });
    await this.page.waitForTimeout(2000);
    try {
      await this.waitForLoginForm(20000);
    } catch {
      await this.page.reload({ waitUntil: 'commit' });
      await this.page.waitForTimeout(2000);
      await this.waitForLoginForm(60000);
    }
  }

  async waitForLoginForm(timeout = 60000) {
    const anyInput = this.page.locator('input').first();
    await anyInput.waitFor({ state: 'visible', timeout });
    await this.emailInput.waitFor({ state: 'visible', timeout });
    await this.passwordInput.waitFor({ state: 'visible', timeout });
    await this.loginButton.waitFor({ state: 'visible', timeout });
  }

  async fillEmail(email: string) {
    await this.emailInput.click();
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.click();
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.loginButton.click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  async expectOnLoginPage() {
    await expect(this.emailInput).toBeVisible({ timeout: 15000 });
    await expect(this.passwordInput).toBeVisible();
  }

  async expectLoginButtonVisible() {
    await expect(this.loginButton).toBeVisible();
  }

  async expectErrorMessage(messagePattern?: RegExp) {
    await expect(this.errorMessage).toBeVisible({ timeout: 5000 });
    if (messagePattern) {
      await expect(this.errorMessage).toContainText(messagePattern);
    }
  }

  async expectNoErrorMessage() {
    await expect(this.errorMessage).not.toBeVisible();
  }
}
