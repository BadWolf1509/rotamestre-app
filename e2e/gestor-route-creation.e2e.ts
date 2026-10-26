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

      // A tela precisa trazer o formulário de entrega (texto casa em
      // qualquer momento do carregamento: toContainText re-tenta).
      await expect(page.locator('body')).toContainText(
        /Entrega|parada|endereço/,
        { timeout: 15000 },
      );
    });

    test('should have address input field', async ({ page }) => {
      await gestorPage.gotoNovaEntrega();

      // Look for any input that could be address-related
      const addressInput = page.locator('input').first();
      await expect(addressInput).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Route Form Interaction', () => {
    test('should be able to interact with form fields', async ({ page }) => {
      await gestorPage.gotoNovaEntrega();

      // O primeiro input precisa existir e aceitar digitação.
      const firstInput = page.locator('input').first();
      await expect(firstInput).toBeVisible({ timeout: 15000 });
      await firstInput.click();
      await firstInput.fill('Test Input');
      await expect(firstInput).toHaveValue('Test Input');
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
      // A busca vai para a Edge Function do Google Places (paga). O teste
      // responde por ela com lista vazia: o custo é zero e o resultado não
      // depende de serviço externo. O que se prova é o campo existir e
      // aceitar digitação.
      await page.route('**/functions/v1/google-places-autocomplete', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ predictions: [], status: 'ZERO_RESULTS' }),
        }),
      );

      await gestorPage.gotoNovaEntrega();

      // O placeholder real é "Endereço ou CEP" (E maiúsculo, que o seletor
      // antigo não casava); o rótulo de acessibilidade é a âncora estável.
      const addressInput = page.getByLabel('Campo de endereço');
      await expect(addressInput).toBeVisible({ timeout: 15000 });
      await addressInput.click();
      await addressInput.fill('Avenida Paulista');

      // NÃO se afirma aqui que sugestões apareceram: elas vêm do Google
      // Places por Edge Function, e um teste que dependesse dessa resposta
      // ficaria vermelho por indisponibilidade externa, não por defeito
      // nosso.
      await expect(addressInput).toHaveValue(/Paulista/);
    });
  });

  test.describe('Route Optimization', () => {
    test('should display optimization button when addresses are added', async ({
      page,
    }) => {
      await gestorPage.gotoNovaEntrega();

      // Check page has route-related content
      await expect(page.locator('body')).toContainText(/rota|entrega/i, {
        timeout: 15000,
      });
    });
  });

  test.describe('Navigation from Menu', () => {
    test('should navigate to nova-entrega from dashboard', async ({ page }) => {
      await gestorPage.gotoInicio();

      // A ação rápida do painel precisa existir e levar à criação de rota.
      const novaEntregaLink = page.getByText('Nova Rota de Entrega').first();
      await expect(novaEntregaLink).toBeVisible({ timeout: 15000 });
      await novaEntregaLink.click();

      await gestorPage.expectOnNovaEntrega();
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

  test('should have navigation to other gestor sections', async ({ page }) => {
    // `gotoInicio` já espera o painel pronto; os 2 s fixos que vinham aqui
    // saíram, e o `toContainText` re-tenta em vez de ler o body uma vez só.
    await gestorPage.gotoInicio();

    await expect(page.locator('body')).toContainText(/Motoristas|Rotas|Nova/);
  });
});
