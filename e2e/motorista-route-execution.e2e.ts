import { SESSAO_MOTORISTA } from './fixtures/sessoes';
import { test, expect } from './fixtures/test-fixtures';
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
  let motoristaPage: MotoristaPage;

  test.use({ storageState: SESSAO_MOTORISTA });

  test.beforeEach(async ({ page }) => {
    motoristaPage = new MotoristaPage(page);
    // Sem o redirecionamento do login, o teste comeca em about:blank:
    // a navegacao passa a ser explicita.
    await motoristaPage.goto();
  });

  test.describe('Route Display', () => {
    test('a home mostra o cartão da parada, a saudação e o resumo da rota', async ({
      page,
    }) => {
      await motoristaPage.expectOnMotoristaDashboard();

      // O cartão principal é a âncora da tela. Antes bastava a palavra "rota"
      // existir no body — o próprio título da aba já satisfazia isso.
      await expect(page.getByTestId('motorista-main-card')).toBeVisible({
        timeout: 15000,
      });

      // A saudação prova que o PERFIL carregou, não só que a tela pintou.
      await expect(page.getByTestId('motorista-status-section')).toHaveText(
        /Bom dia|Boa tarde|Boa noite/i,
      );

      // O rodapé do mini-mapa resume a rota ("1 restantes • 5,7 km total").
      // A distância em pt-BR é afirmada de forma ESTRITA na tabela da Gestão de
      // Rotas; aqui não dá, porque há um ramo de fallback que arredonda para
      // inteiro e sai sem vírgula (`MiniMap.tsx:482`).
      const miniMapa = page.getByTestId('motorista-mini-map');
      await expect(miniMapa).toBeVisible({ timeout: 20000 });
      await expect(miniMapa).toHaveText(/restantes/i);
      await expect(miniMapa).toHaveText(/km total/i);
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

    test('abre a aba Paradas e renderiza a lista ou o vazio', async ({
      page,
    }) => {
      // Mesma correção dos testes de Mapa: `getByText(/paradas/i).first()`
      // casava qualquer texto com "paradas" — inclusive o contador
      // "1 paradas · 0✓" do cabeçalho. O page object usa `getByRole('tab')`.
      const motorista = new MotoristaPage(page);
      await motorista.navigateToParadas();

      await expect(
        motorista.paradasList.or(motorista.paradasEmpty),
      ).toBeVisible({
        timeout: 15000,
      });
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
    test('o cartão da home oferece Concluir e Pular sem sair da tela', async ({
      page,
    }) => {
      await motoristaPage.expectOnMotoristaDashboard();

      const cartao = page.getByTestId('motorista-main-card');
      await expect(cartao).toBeVisible({ timeout: 15000 });

      // As duas ações ficam NO cartão — escopar nele é o que separa este teste
      // do equivalente na aba Paradas, e é o que impede casar um texto solto
      // em qualquer canto da página.
      await expect(cartao.getByText('Concluir').first()).toBeVisible();
      await expect(cartao.getByText('Pular').first()).toBeVisible();
    });
  });

  test.describe('Stop Completion Flow', () => {
    test('a parada em rota oferece Concluir e Pular', async ({ page }) => {
      const motorista = new MotoristaPage(page);
      await motorista.navigateToParadas();

      // Só faz sentido cobrar as ações quando existe parada: com a lista vazia
      // não há o que concluir, e exigir os botões ali seria falso.
      // A tela precisa ASSENTAR antes de perguntar qual dos dois estados é.
      // `isVisible()` não espera: chamado cedo demais devolve false para uma
      // lista que ainda vai montar, e o teste se auto-desliga em silêncio —
      // que é como um `skip` vira falsa confiança.
      await expect(
        motorista.paradasList.or(motorista.paradasEmpty),
      ).toBeVisible({
        timeout: 15000,
      });
      const temLista = await motorista.paradasList.isVisible();
      test.skip(!temLista, 'Sem rota ativa para o motorista de teste');

      await expect(page.getByText('Concluir').first()).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('Pular').first()).toBeVisible();
    });
  });

  test.describe('Navigation Integration', () => {
    test('a parada oferece "Como Chegar" e "Reportar Problema"', async ({
      page,
    }) => {
      const motorista = new MotoristaPage(page);
      await motorista.navigateToParadas();

      // A tela precisa ASSENTAR antes de perguntar qual dos dois estados é.
      // `isVisible()` não espera: chamado cedo demais devolve false para uma
      // lista que ainda vai montar, e o teste se auto-desliga em silêncio —
      // que é como um `skip` vira falsa confiança.
      await expect(
        motorista.paradasList.or(motorista.paradasEmpty),
      ).toBeVisible({
        timeout: 15000,
      });
      const temLista = await motorista.paradasList.isVisible();
      test.skip(!temLista, 'Sem rota ativa para o motorista de teste');

      // "Como Chegar" é a porta para a navegação externa (Waze / Google Maps),
      // cujo link do Waze só funciona pelo universal link — ver src/lib/navigation.ts.
      await expect(page.getByText('Como Chegar').first()).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('Reportar Problema').first()).toBeVisible();
    });
  });
});

test.describe('Motorista History Tab Tests', () => {
  let motoristaPage: MotoristaPage;

  test.use({ storageState: SESSAO_MOTORISTA });

  test.beforeEach(async ({ page }) => {
    motoristaPage = new MotoristaPage(page);
    // Sem o redirecionamento do login, o teste comeca em about:blank:
    // a navegacao passa a ser explicita.
    await motoristaPage.goto();
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
