import { test, expect, testUsers } from './fixtures/test-fixtures';
import { GestorPage } from './pages/gestor.page';
import { LoginPage } from './pages/login.page';

/**
 * E2E Tests for Team Management (Gestão de Equipe)
 * Landing Page Feature: "Monitoramento de performance"
 *
 * Tests the driver management functionality:
 * 1. Viewing driver list
 * 2. Driver CRUD operations
 * 3. Driver status management
 * 4. Performance monitoring
 */
test.describe('Gestor Team Management E2E Tests', () => {
  let loginPage: LoginPage;
  let gestorPage: GestorPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    gestorPage = new GestorPage(page);

    // Login as gestor
    await loginPage.goto();
    await loginPage.login(testUsers.gestor.email, testUsers.gestor.password);
    await page.waitForURL(/.*gestor.*/, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });
  });

  test.describe('Motoristas Page Access', () => {
    test('should access motoristas page', async ({ page: _page }) => {
      await gestorPage.gotoMotoristas();
      await gestorPage.expectOnMotoristas();
    });

    test('should display motoristas management interface', async ({ page }) => {
      await gestorPage.gotoMotoristas();
      await page.waitForTimeout(2000);

      // Should have motorista-related content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();

      const hasMotoristaContent =
        bodyText?.includes('motorista') ||
        bodyText?.includes('Motorista') ||
        bodyText?.includes('equipe') ||
        bodyText?.includes('Adicionar');

      expect(hasMotoristaContent).toBeTruthy();
    });
  });

  test.describe('Motoristas List Display', () => {
    test('should display list of motoristas or empty state', async ({
      page,
    }) => {
      await gestorPage.gotoMotoristas();
      await page.waitForTimeout(3000);

      const bodyText = await page.locator('body').textContent();

      // Either has list of drivers or shows empty state
      const hasDriverContent =
        bodyText?.includes('Nome') ||
        bodyText?.includes('Email') ||
        bodyText?.includes('Nenhum') ||
        bodyText?.includes('cadastrado') ||
        bodyText?.includes('motorista');

      expect(hasDriverContent).toBeTruthy();
    });

    test('should show driver statistics if drivers exist', async ({ page }) => {
      await gestorPage.gotoMotoristas();
      await page.waitForTimeout(3000);

      // Look for statistics or count
      const bodyText = await page.locator('body').textContent();

      // Should show count or statistics
      const hasStats =
        bodyText?.includes('cadastrados') ||
        bodyText?.includes('ativos') ||
        bodyText?.includes('Rotas') ||
        /\d+/.test(bodyText || '');

      expect(hasStats).toBeTruthy();
    });
  });

  test.describe('Add Motorista Button', () => {
    test('should have add motorista button', async ({ page }) => {
      await gestorPage.gotoMotoristas();
      await page.waitForTimeout(2000);

      // Look for add button
      const addButton = page
        .getByText(/adicionar.*motorista|novo.*motorista|\+ novo/i)
        .first();
      const isVisible = await addButton.isVisible().catch(() => false);

      // Either has button or page shows add functionality
      const bodyText = await page.locator('body').textContent();
      const hasAddFunctionality =
        isVisible ||
        bodyText?.includes('Adicionar') ||
        bodyText?.includes('Novo');

      expect(hasAddFunctionality).toBeTruthy();
    });

    test('should open add motorista modal when clicking add button', async ({
      page,
    }) => {
      await gestorPage.gotoMotoristas();
      await page.waitForTimeout(2000);

      const addButton = page
        .getByText(/adicionar.*motorista|novo.*motorista|\+ novo/i)
        .first();

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(1000);

        // Modal should appear with form fields
        const modal = page.locator('[role="dialog"], .modal');
        const formInput = page.locator('input').first();

        // Either modal or form should be visible
        const hasForm =
          (await modal.isVisible().catch(() => false)) ||
          (await formInput.isVisible().catch(() => false));

        expect(hasForm).toBeTruthy();
      }
    });
  });

  test.describe('Motorista Form Validation', () => {
    test('should display motorista form fields', async ({ page }) => {
      await gestorPage.gotoMotoristas();
      await page.waitForTimeout(2000);

      const addButton = page
        .getByText(/adicionar.*motorista|novo.*motorista|\+ novo/i)
        .first();

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(1000);

        // Look for form fields
        const bodyText = await page.locator('body').textContent();

        // Form should have name, email, phone, password fields
        const hasFormFields =
          bodyText?.includes('Nome') ||
          bodyText?.includes('Email') ||
          bodyText?.includes('Telefone') ||
          bodyText?.includes('Senha');

        expect(hasFormFields).toBeTruthy();
      }
    });

    /**
     * Chamava-se "should have required field indicators" e procurava "*" ou
     * "obrigatório" — que NÃO existem neste formulário. Em vez de falhar
     * apontando a lacuna, a asserção foi trocada por `bodyText.length > 100`.
     *
     * O nome passa a dizer o que dá para afirmar: o modal abre com os quatro
     * campos. A ausência de marcação de campo obrigatório fica registrada aqui
     * como observação de produto, não como asserção de algo inexistente.
     */
    test('o modal de adicionar motorista abre com os quatro campos', async ({
      page,
    }) => {
      await gestorPage.gotoMotoristas();

      await page.getByText('Adicionar Motorista').first().click();

      for (const placeholder of [
        /Digite o nome completo/i,
        /email@exemplo\.com/i,
        /\(00\) 00000-0000/,
        /Mínimo 6 caracteres/i,
      ]) {
        await expect(page.getByPlaceholder(placeholder).first()).toBeVisible({
          timeout: 15000,
        });
      }
    });
  });

  // REMOVIDO EM 07/09/2026: "should display performance indicators for drivers"
  // abria a mesma tela que o teste de status abaixo e terminava em
  // `bodyText.length > 100`. O nome ainda prometia "performance", que a lista
  // de motoristas não tem — ela mostra cadastro, não estatística por motorista.
  // A cobertura real da tela (contagens + colunas) está em
  // `dashboard-reports.e2e.ts`, no teste da lista de motoristas.

  test.describe('Driver Status Management', () => {
    test('a lista de motoristas mostra o status de cada um', async ({
      page,
    }) => {
      await gestorPage.gotoMotoristas();

      await expect(page.getByText('Lista de Motoristas').first()).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByText('Status', { exact: true }).first(),
      ).toBeVisible();
      // A conta demo tem 2 cadastrados, 1 ativo — então há de haver ao menos
      // uma linha rotulada. Antes bastava a palavra "Status" existir no body,
      // e ela existe no cabeçalho mesmo sem nenhuma linha.
      await expect(page.getByText(/^(Ativo|Inativo)$/).first()).toBeVisible();
    });
  });
});

test.describe('Gestão Rotas E2E Tests', () => {
  let loginPage: LoginPage;
  let gestorPage: GestorPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    gestorPage = new GestorPage(page);

    await loginPage.goto();
    await loginPage.login(testUsers.gestor.email, testUsers.gestor.password);
    await page.waitForURL(/.*gestor.*/, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });
  });

  test.describe('Gestão Rotas Page', () => {
    test('should access gestao-rotas page', async ({ page: _page }) => {
      await gestorPage.gotoGestaoRotas();
      await gestorPage.expectOnGestaoRotas();
    });

    test('should display route management interface', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();
      await page.waitForTimeout(2000);

      const bodyText = await page.locator('body').textContent();

      // Should have route management content
      const hasRouteContent =
        bodyText?.includes('Rotas') ||
        bodyText?.includes('Filtro') ||
        bodyText?.includes('Data') ||
        bodyText?.includes('Motorista');

      expect(hasRouteContent).toBeTruthy();
    });
  });

  test.describe('Route Filtering', () => {
    test('should have status filter buttons', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();
      await page.waitForTimeout(2000);

      const bodyText = await page.locator('body').textContent();

      // Should have filter options
      const hasFilters =
        bodyText?.includes('Todas') ||
        bodyText?.includes('Pendente') ||
        bodyText?.includes('Em Andamento') ||
        bodyText?.includes('Concluída');

      expect(hasFilters).toBeTruthy();
    });

    test('a busca de rotas filtra a contagem de resultados', async ({
      page,
    }) => {
      await gestorPage.gotoGestaoRotas();

      const busca = page
        .getByPlaceholder(/Buscar por motorista ou data/i)
        .first();
      await expect(busca).toBeVisible({ timeout: 15000 });

      const contador = page
        .getByText(/\d+\s*rota\(s\)\s*encontrada\(s\)/i)
        .first();
      await expect(contador).toBeVisible();
      const antes = await contador.textContent();

      // Termo que nenhum motorista ou data satisfaz: a contagem tem de cair.
      // A versão anterior só olhava se a variável existia e depois conferia o
      // tamanho da página — nunca chegou a digitar nada.
      await busca.fill('zzzzzzzz-nao-existe');
      await expect(contador).not.toHaveText(antes ?? '', { timeout: 15000 });
    });
  });

  test.describe('Route Export Feature', () => {
    test('should have export button for reports', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();

      const exportButton = page.getByText(/exportar/i).first();
      await expect(exportButton).toBeVisible({ timeout: 20000 });
    });
  });

  // REMOVIDO EM 07/09/2026: "should display route summary statistics" era o
  // mesmo teste que "resume as rotas em registradas, concluídas e pendentes"
  // em `dashboard-reports.e2e.ts`, com a mesma não-asserção. Lá ele afirma.
});
