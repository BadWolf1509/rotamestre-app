import { SESSAO_MOTORISTA } from './fixtures/sessoes';
import { test, expect } from './fixtures/test-fixtures';
import { MotoristaPage } from './pages/motorista.page';

test.describe('Motorista Navigation E2E Tests', () => {
  let motoristaPage: MotoristaPage;

  test.use({ storageState: SESSAO_MOTORISTA });

  test.beforeEach(async ({ page }) => {
    motoristaPage = new MotoristaPage(page);
    // Sem o redirecionamento do login, o teste comeca em about:blank:
    // a navegacao passa a ser explicita.
    await motoristaPage.goto();
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

      // Should see paradas content (list) OR empty state (no active route)
      await expect(page).toHaveURL(/.*motorista.*/);
      const paradasContent = motoristaPage.paradasList.or(
        motoristaPage.paradasEmpty,
      );
      await expect(paradasContent).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Mapa tab', async ({ page }) => {
      await motoristaPage.navigateToMapa();

      // Should see mapa content (map view) OR empty state (no active route)
      await expect(page).toHaveURL(/.*motorista.*/);
      const mapaContent = motoristaPage.mapaView.or(motoristaPage.mapaEmpty);
      await expect(mapaContent).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Historico tab', async ({ page }) => {
      await motoristaPage.navigateToHistorico();

      // Should see historico content (list) OR empty state (no routes)
      // Use .first() because FlatList renders both list and empty component in DOM
      await expect(page).toHaveURL(/.*motorista.*/);
      const historicoContent = motoristaPage.historicoList
        .or(motoristaPage.historicoEmpty)
        .first();
      await expect(historicoContent).toBeVisible({ timeout: 10000 });
    });

    test('should return to Inicio tab', async ({ page }) => {
      // First navigate away - use getByRole for tab elements
      await motoristaPage.navigateToHistorico();
      await page.waitForTimeout(1000);

      // Then back to inicio
      await motoristaPage.navigateToInicio();
      await page.waitForTimeout(1000);

      await expect(page).toHaveURL(/.*motorista.*/);
      // URL não é prova de render: a tela de erro mora na mesma URL. A âncora
      // da Início é o cartão principal. Antes conferia-se o comprimento da
      // página, verdadeiro para qualquer coisa que pinte.
      await expect(page.getByTestId('motorista-main-card')).toBeVisible({
        timeout: 15000,
      });
    });
  });

  // REMOVIDOS EM 07/09/2026: "should display motorista dashboard content" e
  // "should show route status or no route message". Os dois abriam a mesma
  // tela e terminavam em `bodyText.length > 100` — um deles aceitava até 50
  // caracteres. O conteúdo da Início é afirmado de verdade em
  // `motorista-route-execution.e2e.ts` › "a home mostra o cartão da parada, a
  // saudação e o resumo da rota", que exige cartão, saudação e o resumo com
  // distância. Este arquivo é sobre NAVEGAÇÃO; a âncora da Início já está
  // coberta no teste de voltar para a aba, acima.

  test.describe('Drawer Menu', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

    test('should open drawer menu from header', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Look for menu button (hamburger icon)
      const menuButton = page
        .locator('[data-testid="menu-button"]')
        .or(page.locator('[aria-label*="menu"]'))
        .or(
          page
            .locator('button')
            .filter({ has: page.locator('svg, [class*="icon"]') })
            .first(),
        );

      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Drawer should be visible
        const drawer = page.locator(
          '[data-testid="drawer-menu"], [role="dialog"], .drawer-menu',
        );
        await expect(drawer).toBeVisible({ timeout: 5000 });
      }
    });

    test('should show profile info in drawer', async ({ page }) => {
      await page.waitForTimeout(2000);

      const menuButton = page
        .locator('[data-testid="menu-button"]')
        .or(page.locator('[aria-label*="menu"]').first());

      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        // Should show user profile information
        const drawer = page.locator(
          '[data-testid="drawer-menu"], [role="dialog"], .drawer-menu',
        );
        if (await drawer.isVisible()) {
          const drawerText = await drawer.textContent();
          expect(drawerText).toBeTruthy();
        }
      }
    });

    test('should have logout option in drawer', async ({ page }) => {
      await page.waitForTimeout(2000);

      const menuButton = page
        .locator('[data-testid="menu-button"]')
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
      const menuButton = page
        .locator('[data-testid="menu-button"]')
        .or(page.locator('[aria-label*="menu"]').first());

      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(1000);

        const logoutButton = page.getByText(/sair/i);
        if (await logoutButton.isVisible()) {
          await logoutButton.click();

          // May need to confirm
          const confirmButton = page.getByRole('button', {
            name: /confirmar|sair|sim/i,
          });
          if (
            await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)
          ) {
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
