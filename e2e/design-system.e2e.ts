import { expect, test } from '@playwright/test';

import { e2eUrl } from './fixtures/test-fixtures';

/**
 * Visual Regression Tests for Design System
 *
 * Coverage Matrix (8 theme combinations):
 * | Theme | Density | Contrast | Test Name |
 * |-------|---------|----------|-----------|
 * | Light | Regular | Normal   | light |
 * | Light | Compact | Normal   | light-compact |
 * | Light | Regular | High     | light-high-contrast |
 * | Light | Compact | High     | light-compact-high-contrast |
 * | Dark  | Regular | Normal   | dark |
 * | Dark  | Compact | Normal   | dark-compact |
 * | Dark  | Regular | High     | dark-high-contrast |
 * | Dark  | Compact | High     | dark-compact-high-contrast |
 */
test.describe('Design System @visual', () => {
  test.skip(!process.env.VISUAL_REGRESSION, 'Set VISUAL_REGRESSION=1 to enable visual snapshots.');

  // =============================================
  // Light Theme Variants
  // =============================================

  test('renders light theme', async ({ page }) => {
    await page.goto(e2eUrl('/design-system'));
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('design-system-light.png', { fullPage: true });
  });

  test('renders light compact', async ({ page }) => {
    await page.goto(e2eUrl('/design-system?theme=light&density=compact'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-light-compact.png', { fullPage: true });
  });

  test('renders light high contrast', async ({ page }) => {
    await page.goto(e2eUrl('/design-system?theme=light&contrast=high'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-light-high-contrast.png', { fullPage: true });
  });

  test('renders light compact high contrast', async ({ page }) => {
    await page.goto(e2eUrl('/design-system?theme=light&density=compact&contrast=high'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-light-compact-high-contrast.png', { fullPage: true });
  });

  // =============================================
  // Dark Theme Variants
  // =============================================

  test('renders dark theme', async ({ page }) => {
    await page.goto(e2eUrl('/design-system?theme=dark'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-dark.png', { fullPage: true });
  });

  test('renders dark compact', async ({ page }) => {
    await page.goto(e2eUrl('/design-system?theme=dark&density=compact'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-dark-compact.png', { fullPage: true });
  });

  test('renders dark high contrast', async ({ page }) => {
    await page.goto(e2eUrl('/design-system?theme=dark&contrast=high'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-dark-high-contrast.png', { fullPage: true });
  });

  test('renders dark compact high contrast', async ({ page }) => {
    await page.goto(e2eUrl('/design-system?theme=dark&density=compact&contrast=high'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-dark-compact-high-contrast.png', { fullPage: true });
  });

  // =============================================
  // Interactive States
  // =============================================

  test('renders toast state', async ({ page, isMobile }) => {
    await page.goto(e2eUrl('/design-system'));
    await page.waitForLoadState('networkidle');
    await page.getByText('Small').first().click();
    const toast = page.getByTestId('design-system-toast');
    await toast.waitFor({ state: 'visible' });
    // Wait longer on mobile for animation stability
    await page.waitForTimeout(isMobile ? 600 : 400);
    await expect(toast).toHaveScreenshot(
      isMobile ? 'design-system-toast-mobile.png' : 'design-system-toast.png',
      { animations: 'disabled' }
    );
  });
});
