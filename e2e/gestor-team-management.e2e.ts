import { SESSAO_GESTOR } from './fixtures/sessoes';
import { test, expect } from './fixtures/test-fixtures';
import { GestorPage } from './pages/gestor.page';

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
  let gestorPage: GestorPage;

  test.use({ storageState: SESSAO_GESTOR });

  test.beforeEach(async ({ page }) => {
    gestorPage = new GestorPage(page);
  });

  test.describe('Motoristas Page Access', () => {
    test('should access motoristas page', async ({ page: _page }) => {
      await gestorPage.gotoMotoristas();
      await gestorPage.expectOnMotoristas();
    });
  });

  test.describe('Motoristas List Display', () => {
    test('should display list of motoristas or empty state', async ({
      page,
    }) => {
      await gestorPage.gotoMotoristas();

      // Locators da própria tela: antes o teste procurava "motorista"/"Nome" no
      // texto do body, que o menu lateral já contém mesmo com a lista quebrada.
      const lista = page.getByTestId('motoristas-tabela');
      const vazio = page.getByTestId('motoristas-vazio');
      await expect(lista.or(vazio)).toBeVisible({ timeout: 15000 });
    });

    test('should show driver statistics if drivers exist', async ({ page }) => {
      await gestorPage.gotoMotoristas();

      // O texto real do contador do cabeçalho ("N Cadastrados  M Ativos"); o
      // `/\d+/` anterior casava com qualquer número do body.
      await expect(page.getByTestId('motoristas-contadores')).toHaveText(
        /\d+\s*Cadastrados\s*\d+\s*Ativos/,
        { timeout: 15000 },
      );
    });
  });

  test.describe('Add Motorista Button', () => {
    test('should open add motorista modal when clicking add button', async ({
      page,
    }) => {
      await gestorPage.gotoMotoristas();

      const addButton = page
        .getByText(/adicionar.*motorista|novo.*motorista|\+ novo/i)
        .first();
      await expect(addButton).toBeVisible({ timeout: 15000 });
      await addButton.click();

      // O modal precisa abrir com o formulário (antes, um input qualquer
      // da página já bastava).
      await expect(
        page.getByPlaceholder(/Digite o nome completo/i).first(),
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Motorista Form Validation', () => {
    test('should display motorista form fields', async ({ page }) => {
      await gestorPage.gotoMotoristas();

      const addButton = page
        .getByText(/adicionar.*motorista|novo.*motorista|\+ novo/i)
        .first();
      await expect(addButton).toBeVisible({ timeout: 15000 });
      await addButton.click();

      // Nome, email, telefone e senha: os campos, não só a palavra no body.
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
  let gestorPage: GestorPage;

  test.use({ storageState: SESSAO_GESTOR });

  test.beforeEach(async ({ page }) => {
    gestorPage = new GestorPage(page);
  });

  test.describe('Gestão Rotas Page', () => {
    test('should access gestao-rotas page', async ({ page: _page }) => {
      await gestorPage.gotoGestaoRotas();
      await gestorPage.expectOnGestaoRotas();
    });
  });

  test.describe('Route Filtering', () => {
    test('should have status filter buttons', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();

      // O grupo de filtros da própria tela (radiogroup): o texto 'Pendente' ou
      // 'Todas' no body casaria com qualquer outra tela. Os quatro chips
      // precisam estar lá.
      const filtros = page.getByRole('radiogroup');
      for (const nome of ['Todas', 'Pendente', 'Em Andamento', 'Concluída']) {
        await expect(
          filtros.getByRole('button', { name: nome, exact: true }),
        ).toBeVisible({ timeout: 15000 });
      }
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
