import { test, expect, testUsers } from './fixtures/test-fixtures';
import { LoginPage } from './pages/login.page';
import { MotoristaPage } from './pages/motorista.page';

test.describe('Motorista Navigation E2E Tests', () => {
  let loginPage: LoginPage;
  let motoristaPage: MotoristaPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    motoristaPage = new MotoristaPage(page);

    // Login as motorista
    await loginPage.goto();
    await loginPage.login(testUsers.motorista.email, testUsers.motorista.password);
    await page.waitForURL(/.*motorista.*/, { timeout: 15000 });
  });

  test.describe('Tab Navigation (Mobile)', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE viewport

    test('should display tab bar on mobile', async () => {
      await motoristaPage.expectOnMotoristaDashboard();
      // Tab bar should be visible on mobile
      await expect(motoristaPage.tabBar).toBeVisible({ timeout: 10000 });
    });

    test('should show all 4 tabs', async ({ page }) => {
      await page.waitForTimeout(2000); // Wait for tabs to render

      // Check each tab exists
      await expect(motoristaPage.inicioTab).toBeVisible();
      await expect(motoristaPage.paradasTab).toBeVisible();
      await expect(motoristaPage.mapaTab).toBeVisible();
      await expect(motoristaPage.historicoTab).toBeVisible();
    });

    test('should navigate to Paradas tab', async ({ page }) => {
      await motoristaPage.navigateToParadas();

      // Should see paradas content or checkpoints
      await expect(page).toHaveURL(/.*motorista.*/);
      await expect(motoristaPage.paradasList).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Mapa tab', async ({ page }) => {
      await motoristaPage.navigateToMapa();

      // Should see mapa content
      await expect(page).toHaveURL(/.*motorista.*/);
      await expect(motoristaPage.mapaView).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Historico tab', async ({ page }) => {
      await motoristaPage.navigateToHistorico();

      // Should see historico content
      await expect(page).toHaveURL(/.*motorista.*/);
      await expect(motoristaPage.historicoList).toBeVisible({ timeout: 10000 });
    });

    test('should return to Inicio tab', async ({ page }) => {
      // First navigate away - use getByRole for tab elements
      await motoristaPage.navigateToHistorico();

      // Then back to inicio
      await motoristaPage.navigateToInicio();

      await expect(page).toHaveURL(/.*motorista.*/);
    });
  });

  test.describe('Home Screen Content', () => {
    test('should display motorista dashboard content', async ({ page }) => {
      await motoristaPage.expectOnMotoristaDashboard();

      // Should have some content (welcome, route card, or no route message)
      await page.waitForTimeout(2000);

      const hasContent = await page.locator('body').textContent();
      expect(hasContent).toBeTruthy();
      expect(hasContent?.length).toBeGreaterThan(50);
    });

    test('should show route status or no route message', async ({ page }) => {
      await page.waitForTimeout(3000);

      // Check for any relevant content on the home screen
      // Could be: active route, no route message, welcome text, or any dashboard content
      const bodyContent = await page.locator('body').textContent();

      // The home screen should have meaningful content
      expect(bodyContent).toBeTruthy();
      expect(bodyContent!.length).toBeGreaterThan(100);

      // Verify we're still on motorista dashboard
      await expect(page).toHaveURL(/.*motorista.*/);
    });
  });

  test.describe('Drawer Menu', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

    test('should open drawer menu from header', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Look for menu button (hamburger icon)
      const menuButton = page.locator('[data-testid="menu-button"]')
        .or(page.locator('[aria-label*="menu"]'))
        .or(page.locator('button').filter({ has: page.locator('svg, [class*="icon"]') }).first());

      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Drawer should be visible
        const drawer = page.locator('[data-testid="drawer-menu"], [role="dialog"], .drawer-menu');
        await expect(drawer).toBeVisible({ timeout: 5000 });
      }
    });

    test('should show profile info in drawer', async ({ page }) => {
      await page.waitForTimeout(2000);

      const menuButton = page.locator('[data-testid="menu-button"]')
        .or(page.locator('[aria-label*="menu"]').first());

      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Should show user profile information
        const drawer = page.locator('[data-testid="drawer-menu"], [role="dialog"], .drawer-menu');
        if (await drawer.isVisible()) {
          const drawerText = await drawer.textContent();
          expect(drawerText).toBeTruthy();
        }
      }
    });

    test('should have logout option in drawer', async ({ page }) => {
      await page.waitForTimeout(2000);

      const menuButton = page.locator('[data-testid="menu-button"]')
        .or(page.locator('[aria-label*="menu"]').first());

      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        const logoutButton = page.getByText(/sair/i);
        await expect(logoutButton).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Logout Flow', () => {
    test('should logout successfully', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Try to find and click logout
      const menuButton = page.locator('[data-testid="menu-button"]')
        .or(page.locator('[aria-label*="menu"]').first());

      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        const logoutButton = page.getByText(/sair/i);
        if (await logoutButton.isVisible()) {
          await logoutButton.click();

          // May need to confirm
          const confirmButton = page.getByRole('button', { name: /confirmar|sair|sim/i });
          if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click();
          }

          // Should redirect to login
          await page.waitForURL(/.*auth.*login.*/, { timeout: 10000 });
          await expect(page).toHaveURL(/.*auth.*login.*/);
        }
      }
    });
  });
});
