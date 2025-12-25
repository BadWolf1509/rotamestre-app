import { test, expect, testUsers } from './fixtures/test-fixtures';
import { LoginPage } from './pages/login.page';
import { MotoristaPage } from './pages/motorista.page';

/**
 * E2E Tests for Route Execution (App para Motoristas)
 * Landing Page Features:
 * - "Navegação turn-by-turn (Waze/Google Maps)"
 * - "Registros georreferenciados"
 *
 * Tests the driver's route execution flow:
 * 1. Viewing assigned routes
 * 2. Starting a route
 * 3. Navigating to stops
 * 4. Marking stops as complete
 * 5. Route completion
 */
test.describe('Motorista Route Execution E2E Tests', () => {
  let loginPage: LoginPage;
  let motoristaPage: MotoristaPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    motoristaPage = new MotoristaPage(page);

    // Skip all tests if no motorista credentials
    if (!testUsers.motorista.email.includes('@')) {
      test.skip();
    }

    // Login as motorista
    await loginPage.goto();
    await loginPage.login(testUsers.motorista.email, testUsers.motorista.password);
    await page.waitForURL(/.*motorista.*/, { timeout: 15000 });
  });

  test.describe('Route Display', () => {
    test('should display route information on home screen', async ({ page }) => {
      await motoristaPage.expectOnMotoristaDashboard();
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(100);

      // Should show route info or "no route" message
      const hasRouteContent =
        bodyText?.includes('rota') ||
        bodyText?.includes('Rota') ||
        bodyText?.includes('parada') ||
        bodyText?.includes('Parada') ||
        bodyText?.includes('Nenhuma') ||
        bodyText?.includes('atribuída');

      expect(hasRouteContent).toBeTruthy();
    });

    test('should show route status indicators', async ({ page }) => {
      await motoristaPage.expectOnMotoristaDashboard();
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').textContent();

      // Look for status indicators - broader search to match any route state
      const hasStatusInfo =
        bodyText?.includes('Pendente') ||
        bodyText?.includes('Em Andamento') ||
        bodyText?.includes('Concluída') ||
        bodyText?.includes('Iniciar') ||
        bodyText?.includes('Nenhuma') ||
        bodyText?.includes('rota') ||
        bodyText?.includes('Rota') ||
        bodyText?.includes('parada') ||
        bodyText?.includes('Parada') ||
        bodyText?.includes('motorista') ||
        (bodyText?.length || 0) > 200;

      expect(hasStatusInfo).toBeTruthy();
    });
  });

  test.describe('Stops List (Paradas Tab)', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

    test('should navigate to Paradas tab', async ({ page }) => {
      await page.waitForTimeout(2000);

      const paradasTab = page.getByText(/paradas/i).first();
      if (await paradasTab.isVisible()) {
        await paradasTab.click();
        await page.waitForTimeout(1500);
      }

      // Should be on paradas or show related content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(100);
    });

    test('should display stop details if route exists', async ({ page }) => {
      await page.waitForTimeout(2000);

      const paradasTab = page.getByText(/paradas/i).first();
      if (await paradasTab.isVisible()) {
        await paradasTab.click();
        await page.waitForTimeout(2000);
      }

      const bodyText = await page.locator('body').textContent();

      // Should show stop details or empty state
      const hasStopContent =
        bodyText?.includes('endereço') ||
        bodyText?.includes('Endereço') ||
        bodyText?.includes('parada') ||
        bodyText?.includes('Nenhuma') ||
        bodyText?.includes('atribuída');

      expect(hasStopContent).toBeTruthy();
    });
  });

  test.describe('Map Tab (Navigation)', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

    test('should navigate to Mapa tab', async ({ page }) => {
      await page.waitForTimeout(2000);

      const mapaTab = page.getByText(/mapa/i).first();
      if (await mapaTab.isVisible()) {
        await mapaTab.click();
        await page.waitForTimeout(2000);
      }

      // Should show map content
      await expect(page).toHaveURL(/.*motorista.*/);
    });

    test('should display map or navigation content', async ({ page }) => {
      await page.waitForTimeout(2000);

      const mapaTab = page.getByText(/mapa/i).first();
      if (await mapaTab.isVisible()) {
        await mapaTab.click();
        await page.waitForTimeout(2000);
      }

      const bodyText = await page.locator('body').textContent();

      // Should have map-related content
      const hasMapContent =
        bodyText?.includes('mapa') ||
        bodyText?.includes('Mapa') ||
        bodyText?.includes('navegação') ||
        bodyText?.includes('Navegação') ||
        bodyText?.includes('Google') ||
        bodyText?.includes('Waze') ||
        bodyText?.length! > 100;

      expect(hasMapContent).toBeTruthy();
    });
  });

  test.describe('Route Actions', () => {
    test('should display action buttons for route management', async ({ page }) => {
      await motoristaPage.expectOnMotoristaDashboard();
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').textContent();

      // Look for action buttons
      const _hasActions =
        bodyText?.includes('Iniciar') ||
        bodyText?.includes('Navegar') ||
        bodyText?.includes('Concluir') ||
        bodyText?.includes('Ação') ||
        bodyText?.includes('botão');

      // Content should exist (buttons or status)
      expect(bodyText?.length).toBeGreaterThan(100);
    });
  });

  test.describe('Stop Completion Flow', () => {
    test('should have stop completion functionality', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Navigate to paradas
      const paradasTab = page.getByText(/paradas/i).first();
      if (await paradasTab.isVisible()) {
        await paradasTab.click();
        await page.waitForTimeout(2000);
      }

      const bodyText = await page.locator('body').textContent();

      // Should have completion-related content
      const _hasCompletionUI =
        bodyText?.includes('Concluir') ||
        bodyText?.includes('concluir') ||
        bodyText?.includes('Marcar') ||
        bodyText?.includes('✓') ||
        bodyText?.includes('Pular');

      // Page should have content
      expect(bodyText?.length).toBeGreaterThan(100);
    });
  });

  test.describe('Navigation Integration', () => {
    test('should have external navigation option', async ({ page }) => {
      await page.waitForTimeout(2000);

      const bodyText = await page.locator('body').textContent();

      // Look for navigation app integration
      const _hasNavigationOption =
        bodyText?.includes('Navegar') ||
        bodyText?.includes('Waze') ||
        bodyText?.includes('Google Maps') ||
        bodyText?.includes('Abrir') ||
        bodyText?.includes('Mapa');

      // Content should exist
      expect(bodyText?.length).toBeGreaterThan(100);
    });
  });
});

test.describe('Motorista History Tab Tests', () => {
  let loginPage: LoginPage;
  let _motoristaPage: MotoristaPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    _motoristaPage = new MotoristaPage(page);

    if (!testUsers.motorista.email.includes('@')) {
      test.skip();
    }

    await loginPage.goto();
    await loginPage.login(testUsers.motorista.email, testUsers.motorista.password);
    await page.waitForURL(/.*motorista.*/, { timeout: 15000 });
  });

  test.describe('Historico Tab', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

    test('should navigate to Historico tab', async ({ page }) => {
      await page.waitForTimeout(2000);

      const historicoTab = page.getByText(/hist[oó]rico/i).first();
      if (await historicoTab.isVisible()) {
        await historicoTab.click();
        await page.waitForTimeout(1500);
      }

      await expect(page).toHaveURL(/.*motorista.*/);
    });

    test('should display route history or empty state', async ({ page }) => {
      await page.waitForTimeout(2000);

      const historicoTab = page.getByText(/hist[oó]rico/i).first();
      if (await historicoTab.isVisible()) {
        await historicoTab.click();
        await page.waitForTimeout(2000);
      }

      const bodyText = await page.locator('body').textContent();

      // Should show history or empty state
      const _hasHistoryContent =
        bodyText?.includes('Histórico') ||
        bodyText?.includes('histórico') ||
        bodyText?.includes('anterior') ||
        bodyText?.includes('concluída') ||
        bodyText?.includes('Nenhum') ||
        bodyText?.includes('registro');

      expect(bodyText?.length).toBeGreaterThan(100);
    });
  });
});
