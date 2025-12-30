import { expect, test } from '@playwright/test';

test.describe('Design System @visual', () => {
  test.skip(!process.env.VISUAL_REGRESSION, 'Set VISUAL_REGRESSION=1 to enable visual snapshots.');

  test('renders light theme', async ({ page }) => {
    await page.goto('/design-system');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('design-system-light.png', { fullPage: true });
  });

  test('renders dark theme', async ({ page }) => {
    await page.goto('/design-system?theme=dark');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-dark.png', { fullPage: true });
  });

  test('renders compact density', async ({ page }) => {
    await page.goto('/design-system?theme=light&density=compact');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-compact.png', { fullPage: true });
  });

  test('renders high contrast', async ({ page }) => {
    await page.goto('/design-system?theme=dark&contrast=high');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('design-system-high-contrast.png', { fullPage: true });
  });

  test('renders toast state', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Toast animation is unstable on mobile viewport.'
    );
    await page.goto('/design-system');
    await page.waitForLoadState('networkidle');
    await page.getByText('Small').first().click();
    const toast = page.getByTestId('design-system-toast');
    await toast.waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await expect(toast).toHaveScreenshot('design-system-toast.png');
  });
});
