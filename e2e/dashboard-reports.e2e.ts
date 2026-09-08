import { test, expect, testUsers } from './fixtures/test-fixtures';
import { GestorPage } from './pages/gestor.page';
import { LoginPage } from './pages/login.page';

/**
 * Painel, relatórios e acompanhamento do gestor.
 *
 * POR QUE ESTE ARQUIVO FOI REESCRITO (07/09/2026). Catorze dos dezessete
 * testes daqui não podiam falhar. O padrão era sempre o mesmo: montava-se um
 * booleano com a verificação de verdade, ele era descartado com um prefixo `_`
 * para calar o linter, e a asserção que sobrava era
 * `expect(bodyText?.length).toBeGreaterThan(100)` — satisfeita por qualquer
 * página que renderize, inclusive a de erro.
 *
 * Os nomes seguiam prometendo o que o corpo não checava, e dois deles
 * ("...in route details") nem abriam os detalhes da rota.
 *
 * As asserções abaixo vêm de uma sonda contra o app rodando, não de suposição:
 * cada testID e cada texto foi lido da tela real antes de virar asserção.
 */
test.describe('Gestor Dashboard Metrics E2E Tests', () => {
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

  test.describe('Dashboard Overview', () => {
    test('exibe o bloco de métricas com os indicadores do dia', async ({
      page,
    }) => {
      await gestorPage.gotoInicio();

      const stats = page.getByTestId('gestor-dashboard-stats');
      await expect(stats).toBeVisible({ timeout: 15000 });

      // Os rótulos do bloco. Antes bastava a palavra "Rota" aparecer em
      // qualquer lugar do body — o próprio menu lateral já satisfazia isso.
      for (const rotulo of [
        'Total Hoje',
        'Em Andamento',
        'Concluídas',
        'km Total',
      ]) {
        await expect(stats.getByText(rotulo, { exact: false })).toBeVisible();
      }
    });

    test('cada indicador do painel traz um número, não só o rótulo', async ({
      page,
    }) => {
      await gestorPage.gotoInicio();

      const stats = page.getByTestId('gestor-dashboard-stats');
      await expect(stats).toBeVisible({ timeout: 15000 });

      // A versão anterior aceitava qualquer dígito em qualquer lugar da página
      // — o "2026" do rodapé passava. Aqui o número tem de estar DENTRO do
      // bloco de métricas, que é onde ele significa alguma coisa.
      const texto = (await stats.innerText()).replace(/\s+/g, ' ');
      expect(texto).toMatch(/\d/);
      // "km Total" sai de formatarDecimal: em pt-BR o separador é vírgula.
      expect(texto).toMatch(/\d+,\d+/);
    });

    test('a tabela de rotas do painel renderiza', async ({ page }) => {
      await gestorPage.gotoInicio();
      await expect(page.getByTestId('rotas-table')).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('Quick Actions from Dashboard', () => {
    test('oferece as ações rápidas de rota e de motoristas', async ({
      page,
    }) => {
      await gestorPage.gotoInicio();

      await expect(page.getByText('Nova Rota de Entrega').first()).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByText('Gerenciar Motoristas').first(),
      ).toBeVisible();
    });

    test('should navigate to route creation from dashboard', async ({
      page,
    }) => {
      await gestorPage.gotoInicio();
      await page.waitForTimeout(2000);

      const createRouteButton = page
        .getByText(/nova.*entrega|criar.*rota|adicionar.*rota/i)
        .first();

      if (await createRouteButton.isVisible().catch(() => false)) {
        await createRouteButton.click();
        await page.waitForTimeout(2000);
        await gestorPage.expectOnNovaEntrega();
      }
    });
  });
});

test.describe('Reports and Export E2E Tests', () => {
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

  test.describe('Route Reports', () => {
    test('resume as rotas em registradas, concluídas e pendentes', async ({
      page,
    }) => {
      await gestorPage.gotoGestaoRotas();
      await expect(page.getByTestId('gestao-rotas-table')).toBeVisible({
        timeout: 15000,
      });

      for (const rotulo of ['Rotas registradas', 'Concluídas', 'Pendentes']) {
        await expect(
          page.getByText(rotulo, { exact: false }).first(),
        ).toBeVisible();
      }
    });

    test('mostra a contagem de rotas encontradas pelo filtro', async ({
      page,
    }) => {
      await gestorPage.gotoGestaoRotas();

      // "6 rota(s) encontrada(s)" — o número é o que o filtro devolveu.
      await expect(
        page.getByText(/\d+\s*rota\(s\)\s*encontrada\(s\)/i).first(),
      ).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('CSV Export', () => {
    test('should have CSV export button', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();
      await expect(page.getByText(/exportar/i).first()).toBeVisible({
        timeout: 15000,
      });
    });

    test('o menu de exportação abre com CSV e Excel', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();

      // "Exportar ▾" é um menu, não um download direto: clicar revela as duas
      // opções. O teste anterior clicava e conferia o tamanho da página.
      await page
        .getByText(/^Exportar/i)
        .first()
        .click();

      await expect(page.getByText('Exportar CSV')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(/Exportar Excel/i)).toBeVisible();
    });
  });

  test.describe('Route Details Report', () => {
    test('"Ver Detalhes" leva ao mapa da rota', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();
      await expect(page.getByTestId('gestao-rotas-table')).toBeVisible({
        timeout: 15000,
      });

      await page.getByText('Ver Detalhes').first().click();

      await expect(page).toHaveURL(/mapa-rota/, { timeout: 15000 });
    });
  });
});

test.describe('Real-time Tracking E2E Tests', () => {
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

  test.describe('Live Route Tracking', () => {
    test('o painel destaca as rotas em andamento', async ({ page }) => {
      await gestorPage.gotoInicio();

      const stats = page.getByTestId('gestor-dashboard-stats');
      await expect(stats).toBeVisible({ timeout: 15000 });
      await expect(
        stats.getByText('Em Andamento', { exact: false }),
      ).toBeVisible();
    });

    test('o filtro "Em Andamento" do painel é acionável', async ({ page }) => {
      await gestorPage.gotoInicio();

      // O filtro tem testID próprio; antes o teste procurava o texto
      // "em andamento", que também é rótulo de métrica e de status na tabela —
      // pegava o primeiro que aparecesse.
      const filtro = page.getByTestId('filter-status-em_andamento');
      await expect(filtro).toBeVisible({ timeout: 15000 });
      await filtro.click();

      await expect(page.getByTestId('rotas-table')).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('Route Map View', () => {
    test('should access map view for route tracking', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();
      await page.waitForTimeout(2000);

      const viewButton = page.getByText(/ver.*detalhes|mapa|detalhes/i).first();

      if (await viewButton.isVisible().catch(() => false)) {
        await viewButton.click();
        await page.waitForTimeout(2000);

        const currentUrl = page.url();
        expect(currentUrl).toContain('gestor');
      }
    });
  });
});

test.describe('Performance Analytics E2E Tests', () => {
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

  test.describe('Driver Performance', () => {
    /**
     * Aqui havia DOIS testes — "should show driver performance metrics" e
     * "should display driver route statistics" — que abriam a mesma tela e
     * faziam a mesma não-asserção. Viraram um só, e o nome mudou porque os
     * antigos prometiam o que a tela não tem: a lista de motoristas mostra
     * cadastrados/ativos e os dados de cadastro, e NÃO estatísticas de rota
     * por motorista. Escrever asserção para o que não existe seria repetir o
     * defeito com outra roupa.
     */
    test('a lista de motoristas traz as contagens e a tabela de cadastro', async ({
      page,
    }) => {
      await gestorPage.gotoMotoristas();

      await expect(page.getByText('Lista de Motoristas').first()).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByText('Cadastrados', { exact: false }).first(),
      ).toBeVisible();
      await expect(
        page.getByText('Ativos', { exact: false }).first(),
      ).toBeVisible();
      await expect(page.getByText('Adicionar Motorista').first()).toBeVisible();

      for (const coluna of ['Nome', 'Status']) {
        await expect(
          page.getByText(coluna, { exact: true }).first(),
        ).toBeVisible();
      }
    });
  });

  test.describe('Distance and Time Metrics', () => {
    /**
     * Os dois testes originais chamavam-se "...in route details" mas nunca
     * abriam os detalhes: liam a Gestão de Rotas e conferiam o tamanho da
     * página. A coluna existe mesmo é na tabela da Gestão de Rotas, então o
     * nome passa a dizer isso.
     */
    test('a tabela de rotas traz distância em pt-BR', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();

      const tabela = page.getByTestId('gestao-rotas-table');
      await expect(tabela).toBeVisible({ timeout: 15000 });
      await expect(
        tabela.getByText('Distância', { exact: false }).first(),
      ).toBeVisible();

      // "5,7 km" — vírgula, não ponto. É a saída de formatarDecimal, e é
      // exatamente o que regride quando alguém troca por Intl/toFixed ou
      // quando o Hermes fica sem os dados de locale do ICU.
      await expect(tabela.getByText(/\d+,\d+\s*km/).first()).toBeVisible();
    });

    test('a tabela de rotas traz início e conclusão com data e hora', async ({
      page,
    }) => {
      await gestorPage.gotoGestaoRotas();

      const tabela = page.getByTestId('gestao-rotas-table');
      await expect(tabela).toBeVisible({ timeout: 15000 });

      for (const coluna of ['Iniciada', 'Concluída']) {
        await expect(
          tabela.getByText(coluna, { exact: false }).first(),
        ).toBeVisible();
      }

      // "05/09, 22:51" — dd/MM, HH:mm.
      await expect(
        tabela.getByText(/\d{2}\/\d{2},\s*\d{2}:\d{2}/).first(),
      ).toBeVisible();
    });
  });
});
