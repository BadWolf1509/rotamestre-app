import { test, expect } from '@playwright/test';

import { e2eUrl } from './fixtures/test-fixtures';

/**
 * Smoke test - minimal test to verify Playwright can load the app
 */
test.describe('Smoke Tests', () => {
  test('should load the app homepage', async ({ page }) => {
    // Navigate to root with e2e param to skip font loading
    const response = await page.goto(e2eUrl('/'), { timeout: 30000 });

    // Should get a response
    expect(response).not.toBeNull();
    expect(response?.status()).toBeLessThan(400);

    // Should have some content
    await page.waitForTimeout(3000);
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should navigate to login page', async ({ page }) => {
    // Navigate to login
    const response = await page.goto(e2eUrl('/auth/login'), { timeout: 30000 });

    // Should get a response
    expect(response).not.toBeNull();
    expect(response?.status()).toBeLessThan(400);

    // Wait for app to render
    await page.waitForTimeout(3000);

    // Should have login-related content
    const pageText = await page.textContent('body');
    expect(pageText).toBeTruthy();
  });

  test('should find email input on login page', async ({ page }) => {
    await page.goto(e2eUrl('/auth/login'), { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Try different selectors for email input
    const emailInput = page.locator('input').first();

    // Should have at least one input
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });
});
