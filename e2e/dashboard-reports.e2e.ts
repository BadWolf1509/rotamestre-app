import { SESSAO_GESTOR } from './fixtures/sessoes';
import { test, expect } from './fixtures/test-fixtures';
import { GestorPage } from './pages/gestor.page';

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
  let gestorPage: GestorPage;

  test.use({ storageState: SESSAO_GESTOR });

  test.beforeEach(async ({ page }) => {
    gestorPage = new GestorPage(page);
  });

  test.describe('Dashboard Overview', () => {
    test('exibe o resumo do dia numa frase, no lugar dos cartões', async ({
      page,
    }) => {
      await gestorPage.gotoInicio();

      const stats = page.getByTestId('gestor-dashboard-stats');
      await expect(stats).toBeVisible({ timeout: 15000 });

      // Desktop (o projeto chromium): o resumo é uma frase — "3 rotas em
      // andamento, 2 pendentes — 12 de 40 paradas feitas, 48,5 km" — ou, sem
      // rota, a frase do vazio ("Nenhuma rota cadastrada hoje", sem filtro).
      // Os cartões de número saíram.
      const resumo = stats.getByTestId('gestor-dashboard-resumo');
      await expect(resumo).toBeVisible();
      await expect(resumo).toHaveText(
        /^(\d+ rotas? .+ — \d+ de \d+ paradas? feitas?, \d+,\d km|Nenhuma rota cadastrada hoje)$/,
      );
      await expect(stats.getByText('Total Hoje')).toHaveCount(0);
    });

    test('o resumo traz os números do dia, com vírgula decimal', async ({
      page,
    }) => {
      await gestorPage.gotoInicio();

      const resumo = page.getByTestId('gestor-dashboard-resumo');
      await expect(resumo).toBeVisible({ timeout: 15000 });

      // O número tem de estar DENTRO do resumo, onde ele significa alguma
      // coisa. A distância sai de formatarDecimal: em pt-BR, vírgula.
      const texto = (await resumo.innerText()).replace(/\s+/g, ' ');
      if (texto !== 'Nenhuma rota cadastrada hoje') {
        expect(texto).toMatch(/\d+ de \d+ paradas? feitas?/);
        expect(texto).toMatch(/\d+,\d km$/);
      }
    });

    test('a tabela de rotas do painel renderiza', async ({ page }) => {
      await gestorPage.gotoInicio();
      await expect(page.getByTestId('rotas-table')).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('Quick Actions from Dashboard', () => {
    test('o cabeçalho oferece "Nova rota" e leva à criação', async ({
      page,
    }) => {
      await gestorPage.gotoInicio();

      // As "Ações Rápidas" saíram do desktop: a ação de criar rota ficou no
      // cabeçalho da página (as outras duas estão no menu lateral).
      const novaRota = page.getByRole('button', {
        name: 'Nova rota',
        exact: true,
      });
      await expect(novaRota).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Ações Rápidas')).toHaveCount(0);
      await novaRota.click();

      await gestorPage.expectOnNovaEntrega();
    });
  });
});

test.describe('Reports and Export E2E Tests', () => {
  let gestorPage: GestorPage;

  test.use({ storageState: SESSAO_GESTOR });

  test.beforeEach(async ({ page }) => {
    gestorPage = new GestorPage(page);
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

      // "6 rotas encontradas" — o número é o que o filtro devolveu.
      await expect(
        page.getByText(/\d+\s*rotas?\s*encontradas?/i).first(),
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
    test('"Ver detalhes" leva ao mapa da rota', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();
      await expect(page.getByTestId('gestao-rotas-table')).toBeVisible({
        timeout: 15000,
      });

      await page.getByText('Ver detalhes').first().click();

      await expect(page).toHaveURL(/mapa-rota/, { timeout: 15000 });
    });
  });
});

test.describe('Real-time Tracking E2E Tests', () => {
  let gestorPage: GestorPage;

  test.use({ storageState: SESSAO_GESTOR });

  test.beforeEach(async ({ page }) => {
    gestorPage = new GestorPage(page);
  });

  test.describe('Live Route Tracking', () => {
    test('o resumo fala das rotas em andamento quando há alguma', async ({
      page,
    }) => {
      await gestorPage.gotoInicio();

      const resumo = page.getByTestId('gestor-dashboard-resumo');
      await expect(resumo).toBeVisible({ timeout: 15000 });

      // Status com zero rota sai da frase: o resumo diz "em andamento" se, e
      // só se, alguma linha da lista estiver em andamento.
      const lista = page.getByTestId('rotas-table');
      await expect(lista).toBeVisible();
      const emAndamentoNaLista = await lista
        .getByText('Em andamento', { exact: true })
        .count();
      if (emAndamentoNaLista > 0) {
        await expect(resumo).toContainText('em andamento');
      } else {
        await expect(resumo).not.toContainText('em andamento');
      }
    });

    test('o filtro "Em andamento" do painel é acionável', async ({ page }) => {
      await gestorPage.gotoInicio();

      // A barra de filtros começa recolhida: abre pelo botão "Filtros".
      const abrir = page.getByTestId('route-filters-toggle');
      await expect(abrir).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('route-filters-resumo')).toContainText(
        'Todos os status',
      );
      await abrir.click();

      // O filtro tem testID próprio; o texto "em andamento" também está no
      // resumo e no status das linhas.
      const filtro = page.getByTestId('filter-status-em_andamento');
      await expect(filtro).toBeVisible({ timeout: 15000 });
      await filtro.click();

      await expect(page.getByTestId('route-filters-resumo')).toContainText(
        'Em andamento',
      );
      await expect(page.getByTestId('rotas-table')).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe('Route Map View', () => {
    test('should access map view for route tracking', async ({ page }) => {
      await gestorPage.gotoGestaoRotas();
      await expect(page.getByTestId('gestao-rotas-table')).toBeVisible({
        timeout: 15000,
      });

      // Ação de linha da tabela, com o rótulo exato (antes um regex solto
      // /ver.*detalhes|mapa|detalhes/ pegava o primeiro texto que casasse).
      await page.getByText('Ver detalhes').first().click();

      await expect(page).toHaveURL(/mapa-rota/, { timeout: 15000 });
    });
  });
});

test.describe('Performance Analytics E2E Tests', () => {
  let gestorPage: GestorPage;

  test.use({ storageState: SESSAO_GESTOR });

  test.beforeEach(async ({ page }) => {
    gestorPage = new GestorPage(page);
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
      await expect(page.getByText('Adicionar motorista').first()).toBeVisible();

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
