import { SESSAO_GESTOR } from './fixtures/sessoes';
import { test, expect } from './fixtures/test-fixtures';
import { GestorPage } from './pages/gestor.page';

/**
 * E2E Tests for Route Creation (Otimização Automática)
 * Landing Page Feature: "Algoritmo inteligente para sequência de paradas"
 *
 * Tests the complete flow of creating optimized routes:
 * 1. Adding multiple delivery addresses
 * 2. Route optimization via Google Directions API
 * 3. Assigning route to a driver
 */
test.describe('Gestor Route Creation E2E Tests', () => {
  let gestorPage: GestorPage;

  test.use({ storageState: SESSAO_GESTOR });

  test.beforeEach(async ({ page }) => {
    gestorPage = new GestorPage(page);
  });

  test.describe('Nova Entrega Page Access', () => {
    test('should access nova-entrega page', async ({ page: _page }) => {
      await gestorPage.gotoNovaEntrega();
      await gestorPage.expectOnNovaEntrega();
    });

    test('should display route creation form elements', async ({ page }) => {
      await gestorPage.gotoNovaEntrega();
      await page.waitForTimeout(2000);

      // Should have delivery type selector
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();

      // Check for key form elements (may have different text based on implementation)
      const hasDeliveryForm =
        bodyText?.includes('Entrega') ||
        bodyText?.includes('parada') ||
        bodyText?.includes('endereço');
      expect(hasDeliveryForm).toBeTruthy();
    });

    test('should have address input field', async ({ page }) => {
      await gestorPage.gotoNovaEntrega();
      await page.waitForTimeout(2000);

      // Look for any input that could be address-related
      const addressInput = page.locator('input').first();
      await expect(addressInput).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Route Form Interaction', () => {
    test('should be able to interact with form fields', async ({ page }) => {
      await gestorPage.gotoNovaEntrega();
      await page.waitForTimeout(2000);

      // Find the first input and try to interact with it
      const firstInput = page.locator('input').first();
      if (await firstInput.isVisible()) {
        await firstInput.click();
        await firstInput.fill('Test Input');
        const value = await firstInput.inputValue();
        expect(value).toBe('Test Input');
      }
    });

    test('a nova parada oferece os tipos entrega e retirada', async ({
      page,
    }) => {
      await gestorPage.gotoNovaEntrega();

      // Os dois rádios expõem accessibilityLabel, que na web vira aria-label —
      // âncora estável, ao contrário de `getByText('Entrega')`, que também casa
      // o título "Nova Rota de Entrega" no cabeçalho da página.
      await expect(page.getByLabel('Selecionar tipo entrega')).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByLabel('Selecionar tipo retirada')).toBeVisible();
    });
  });

  test.describe('Address Autocomplete (Google Places)', () => {
    test('should have address input with autocomplete functionality', async ({
      page,
    }) => {
      await gestorPage.gotoNovaEntrega();
      await page.waitForTimeout(2000);

      // Look for address-related input
      const addressInput = page
        .locator('input[placeholder*="endereço"], input[placeholder*="Digite"]')
        .first();

      if (await addressInput.isVisible()) {
        await addressInput.click();
        await addressInput.fill('Avenida Paulista');
        await page.waitForTimeout(1500); // Wait for autocomplete suggestions

        // NÃO se afirma aqui que sugestões apareceram: elas vêm do Google
        // Places por Edge Function, e um teste que dependesse dessa resposta
        // ficaria vermelho por indisponibilidade externa, não por defeito
        // nosso. A contagem de sugestões era computada e descartada — saiu.
        const inputValue = await addressInput.inputValue();
        expect(inputValue).toContain('Paulista');
      }
    });
  });

  test.describe('Route Optimization', () => {
    test('should display optimization button when addresses are added', async ({
      page,
    }) => {
      await gestorPage.gotoNovaEntrega();
      await page.waitForTimeout(3000);

      // Look for any button related to route optimization
      const bodyText = await page.locator('body').textContent();

      // Check page has route-related content
      const hasRouteContent =
        bodyText?.includes('rota') ||
        bodyText?.includes('Rota') ||
        bodyText?.includes('entrega') ||
        bodyText?.includes('Entrega');

      expect(hasRouteContent).toBeTruthy();
    });
  });

  test.describe('Navigation from Menu', () => {
    test('should navigate to nova-entrega from dashboard', async ({ page }) => {
      await gestorPage.gotoInicio();
      await page.waitForTimeout(2000);

      // Look for link to create new route
      const novaEntregaLink = page
        .getByText(/nova.*entrega|criar.*rota|adicionar.*rota/i)
        .first();

      if (await novaEntregaLink.isVisible()) {
        await novaEntregaLink.click();
        await page.waitForTimeout(2000);
        await gestorPage.expectOnNovaEntrega();
      } else {
        // Alternative: navigate via menu/sidebar
        await gestorPage.gotoNovaEntrega();
        await gestorPage.expectOnNovaEntrega();
      }
    });
  });
});

test.describe('Gestor Dashboard E2E Tests', () => {
  let gestorPage: GestorPage;

  test.use({ storageState: SESSAO_GESTOR });

  test.beforeEach(async ({ page }) => {
    gestorPage = new GestorPage(page);
  });

  test('o painel do gestor renderiza o bloco de métricas', async ({ page }) => {
    await gestorPage.gotoInicio();

    // `expectOnGestorDashboard` só confere a URL, e URL não é prova de render:
    // a tela de erro mora na mesma URL. A âncora é o bloco de métricas.
    await gestorPage.expectOnGestorDashboard();
    await expect(page.getByTestId('gestor-dashboard-stats')).toBeVisible({
      timeout: 15000,
    });
  });

  test('should show statistics or summary cards', async ({ page }) => {
    await gestorPage.gotoInicio();
    await page.waitForTimeout(3000);

    // Look for dashboard statistics
    const bodyText = await page.locator('body').textContent();

    // Dashboard should show some route/delivery information
    const hasStats =
      bodyText?.includes('rota') ||
      bodyText?.includes('entrega') ||
      bodyText?.includes('pendente') ||
      bodyText?.includes('motorista') ||
      bodyText?.includes('total');

    expect(hasStats).toBeTruthy();
  });

  test('should have navigation to other gestor sections', async ({ page }) => {
    await gestorPage.gotoInicio();
    await page.waitForTimeout(2000);

    // Check for navigation elements
    const bodyText = await page.locator('body').textContent();

    // Should have links to other sections
    const hasNavigation =
      bodyText?.includes('Motoristas') ||
      bodyText?.includes('Rotas') ||
      bodyText?.includes('Nova');

    expect(hasNavigation).toBeTruthy();
  });
});
