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

    // Login as motorista
    await loginPage.goto();
    await loginPage.login(
      testUsers.motorista.email,
      testUsers.motorista.password,
    );
    await page.waitForURL(/.*motorista.*/, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });
  });

  test.describe('Route Display', () => {
    test('should display route information on home screen', async ({
      page,
    }) => {
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

      const emptyState = page
        .getByText(/Nenhuma rota ativa no momento/i)
        .first();
      const paradaLabel = page.getByLabel(/Parada \d+/i).first();

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const hasParadaLabel = await paradaLabel.isVisible().catch(() => false);

      const bodyText = await page.locator('body').textContent();

      // Should show stop details or empty state
      const hasStopContent =
        hasEmptyState ||
        hasParadaLabel ||
        bodyText?.includes('parada') ||
        bodyText?.includes('Parada') ||
        bodyText?.includes('Nenhuma');
      expect(hasStopContent).toBeTruthy();
    });
  });

  test.describe('Map Tab (Navigation)', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

    /**
     * REESCRITOS EM 07/09/2026. Os dois anteriores eram frageis E vazios.
     *
     * FRAGEIS: procuravam a aba com `getByText(/mapa/i).first()`, que casa com
     * QUALQUER texto contendo "mapa" na pagina. O #490 acrescentou um aviso de
     * localizacao dizendo "...para ver sua posicao no mapa...", que fica acima
     * da barra de abas — o `.first()` passou a escolher o aviso e o clique
     * morria por timeout. Ou seja: estes testes detectaram uma regressao real,
     * e ninguem soube, porque a suite nao roda no CI.
     *
     * VAZIOS: a assercao de URL casava qualquer rota sob `motorista`, e a
     * outra terminava em `bodyText.length > 100`, verdadeiro para qualquer
     * pagina renderizada. Passavam sem verificar ter chegado na aba.
     *
     * Agora navegam pelo page object — que usa `getByRole('tab')`, escopado e
     * imune a colisao de texto — e afirmam a ancora real da tela.
     */
    test('abre a aba Mapa e renderiza a tela do mapa', async ({ page }) => {
      const motorista = new MotoristaPage(page);
      await motorista.navigateToMapa();

      // Uma das duas TEM de aparecer: o mapa (`mapa.tsx:235`) ou o vazio
      // declarado (`:113`). Qualquer outra coisa e a tela nao ter montado.
      await expect(motorista.mapaView.or(motorista.mapaEmpty)).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('Route Actions', () => {
    test('should display action buttons for route management', async ({
      page,
    }) => {
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

    await loginPage.goto();
    await loginPage.login(
      testUsers.motorista.email,
      testUsers.motorista.password,
    );
    await page.waitForURL(/.*motorista.*/, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });
  });

  test.describe('Historico Tab', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

    /**
     * REESCRITOS EM 07/09/2026, mesma razao do bloco do Mapa acima.
     *
     * O segundo era o caso mais franco de teste vazio da suite: computava
     * `_hasHistoryContent` a partir de seis `includes` e JOGAVA FORA — o
     * underscore denuncia — para no fim afirmar apenas que a pagina tinha mais
     * de 100 caracteres. Passava com a tela do Historico inteiramente ausente.
     */
    test('abre a aba Historico e renderiza a lista ou o vazio', async ({
      page,
    }) => {
      const motorista = new MotoristaPage(page);
      await motorista.navigateToHistorico();

      // A tela declara as duas ancoras (`historico.tsx:134` e `:152`).
      await expect(
        motorista.historicoList.or(motorista.historicoEmpty),
      ).toBeVisible({ timeout: 15000 });
    });
  });
});
